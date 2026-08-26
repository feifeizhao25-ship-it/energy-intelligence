// 审计服务
// 护城河核心：每次计算/诊断都落库，可追溯可复现

import { prisma } from '@/lib/prisma';
import type {
    AuditRecord,
    AuditableResult,
    CalcVersionMeta,
    DataEvidence,
    AssumptionSet,
    RiskWarning,
    OperationConfirmation,
    OperationRiskLevel
} from './types';
import { getCalibrations, CALIBRATION_VERSION } from './calibrations';
import crypto from 'crypto';

// 当前版本号
export const CALC_VERSION = '1.1.0';
export const ASSUMPTION_VERSION = '2024.1';

/**
 * 生成审计ID
 */
function generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `AUD-${timestamp}-${random}`;
}

/**
 * 计算校验哈希
 * 用于防篡改验证
 */
function computeChecksum(record: Partial<AuditRecord>): string {
    const content = JSON.stringify({
        inputs: record.inputs,
        outputs: record.outputs,
        versionMeta: record.versionMeta,
        timestamp: record.createdAt,
    });
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * 计算可复现性哈希
 * 相同输入+版本应产生相同哈希
 */
function computeReproducibilityHash(
    inputs: Record<string, unknown>,
    versionMeta: CalcVersionMeta,
    assumptions: AssumptionSet
): string {
    const content = JSON.stringify({
        inputs,
        calcVersion: versionMeta.calcVersion,
        assumptionVersion: versionMeta.assumptionVersion,
        assumptionId: assumptions.id,
    });
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 12);
}

/**
 * 创建审计记录
 */
export async function createAuditRecord(params: {
    type: AuditRecord['type'];
    projectId?: string;
    userId: string;
    orgId?: string;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    evidences: DataEvidence[];
    assumptions: AssumptionSet;
    intermediates?: AuditRecord['intermediates'];
    calibrations?: string[];
    ipAddress?: string;
    userAgent?: string;
}): Promise<AuditRecord> {
    const now = new Date().toISOString();
    const auditId = generateAuditId();

    const versionMeta: CalcVersionMeta = {
        calcVersion: CALC_VERSION,
        assumptionVersion: ASSUMPTION_VERSION,
        timestamp: now,
    };

    const record: AuditRecord = {
        id: auditId,
        type: params.type,
        projectId: params.projectId,
        userId: params.userId,
        orgId: params.orgId,
        versionMeta,
        inputs: params.inputs,
        evidences: params.evidences,
        assumptions: params.assumptions,
        outputs: params.outputs,
        intermediates: params.intermediates,
        calibrations: params.calibrations,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        createdAt: now,
    };

    record.checksum = computeChecksum(record);

    // 持久化到数据库
    try {
        await prisma.auditLog.create({
            data: {
                id: auditId,
                type: params.type,
                projectId: params.projectId,
                userId: params.userId,
                orgId: params.orgId,
                calcVersion: CALC_VERSION,
                assumptionVersion: ASSUMPTION_VERSION,
                inputs: params.inputs as any,
                outputs: params.outputs as any,
                evidences: params.evidences as any,
                assumptions: params.assumptions as any,
                intermediates: params.intermediates as any,
                calibrations: params.calibrations,
                checksum: record.checksum,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                createdAt: new Date(now),
            },
        });
    } catch (error) {
        // 如果审计表不存在，静默失败但记录日志
        console.warn('Audit log write failed (table may not exist):', error);
    }

    return record;
}

/**
 * 包装计算结果为可审计格式
 */
export function wrapAuditableResult<T>(
    result: T,
    auditRecord: AuditRecord,
    calibrationIds: string[],
    riskWarnings?: RiskWarning[],
    confidence?: number,
    validHours?: number
): AuditableResult<T> {
    const calibrations = getCalibrations(calibrationIds);

    return {
        result,
        audit: {
            auditId: auditRecord.id,
            calcVersion: auditRecord.versionMeta.calcVersion,
            assumptionVersion: auditRecord.versionMeta.assumptionVersion,
            dataSources: auditRecord.evidences.map(e => e.sourceName),
            computedAt: auditRecord.createdAt,
            reproducibilityHash: computeReproducibilityHash(
                auditRecord.inputs,
                auditRecord.versionMeta,
                auditRecord.assumptions
            ),
        },
        calibrations,
        riskWarnings,
        confidence,
        validUntil: validHours
            ? new Date(Date.now() + validHours * 3600000).toISOString()
            : undefined,
    };
}

/**
 * 查询审计记录
 */
export async function getAuditRecord(auditId: string): Promise<AuditRecord | null> {
    try {
        const record = await prisma.auditLog.findUnique({
            where: { id: auditId },
        });

        if (!record) return null;

        return {
            id: record.id,
            type: record.type as AuditRecord['type'],
            projectId: record.projectId || undefined,
            userId: record.userId,
            orgId: record.orgId || undefined,
            versionMeta: {
                calcVersion: record.calcVersion,
                assumptionVersion: record.assumptionVersion,
                timestamp: record.createdAt.toISOString(),
            },
            inputs: record.inputs as Record<string, unknown>,
            evidences: record.evidences as DataEvidence[],
            assumptions: record.assumptions as AssumptionSet,
            outputs: record.outputs as Record<string, unknown>,
            intermediates: record.intermediates as AuditRecord['intermediates'],
            calibrations: record.calibrations as string[] | undefined,
            ipAddress: record.ipAddress || undefined,
            userAgent: record.userAgent || undefined,
            createdAt: record.createdAt.toISOString(),
            checksum: record.checksum || undefined,
        };
    } catch (error) {
        console.error('Failed to get audit record:', error);
        return null;
    }
}

/**
 * 验证审计记录完整性
 */
export async function verifyAuditRecord(auditId: string): Promise<{
    valid: boolean;
    reason?: string;
}> {
    const record = await getAuditRecord(auditId);
    if (!record) {
        return { valid: false, reason: '记录不存在' };
    }

    const expectedChecksum = computeChecksum(record);
    if (record.checksum && record.checksum !== expectedChecksum) {
        return { valid: false, reason: '校验和不匹配，记录可能被篡改' };
    }

    return { valid: true };
}

/**
 * 获取项目审计历史
 */
export async function getProjectAuditHistory(
    projectId: string,
    options?: {
        type?: AuditRecord['type'];
        limit?: number;
        offset?: number;
    }
): Promise<AuditRecord[]> {
    try {
        const records = await prisma.auditLog.findMany({
            where: {
                projectId,
                ...(options?.type ? { type: options.type } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        });

        return records.map(record => ({
            id: record.id,
            type: record.type as AuditRecord['type'],
            projectId: record.projectId || undefined,
            userId: record.userId,
            orgId: record.orgId || undefined,
            versionMeta: {
                calcVersion: record.calcVersion,
                assumptionVersion: record.assumptionVersion,
                timestamp: record.createdAt.toISOString(),
            },
            inputs: record.inputs as Record<string, unknown>,
            evidences: record.evidences as DataEvidence[],
            assumptions: record.assumptions as AssumptionSet,
            outputs: record.outputs as Record<string, unknown>,
            createdAt: record.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Failed to get project audit history:', error);
        return [];
    }
}

/**
 * 操作风险评估
 */
export function assessOperationRisk(
    operationType: string,
    params?: Record<string, unknown>
): OperationConfirmation {
    // 风险分级规则
    const riskRules: Record<string, OperationRiskLevel> = {
        // 只读操作
        'query': 'READ_ONLY',
        'search': 'READ_ONLY',
        'view': 'READ_ONLY',
        'export_preview': 'READ_ONLY',

        // 低风险写入
        'save_draft': 'LOW_WRITE',
        'update_notes': 'LOW_WRITE',
        'bookmark': 'LOW_WRITE',

        // 中等风险写入
        'update_config': 'MEDIUM_WRITE',
        'update_params': 'MEDIUM_WRITE',
        'create_project': 'MEDIUM_WRITE',
        'export_report': 'MEDIUM_WRITE',

        // 高风险写入
        'submit_workorder': 'HIGH_WRITE',
        'create_workpermit': 'HIGH_WRITE',
        'confirm_diagnosis': 'HIGH_WRITE',
        'batch_update': 'HIGH_WRITE',

        // 关键写入
        'shutdown_station': 'CRITICAL_WRITE',
        'emergency_stop': 'CRITICAL_WRITE',
        'delete_project': 'CRITICAL_WRITE',
        'change_permissions': 'CRITICAL_WRITE',
    };

    const riskLevel = riskRules[operationType] || 'MEDIUM_WRITE';

    const confirmationTypes: Record<OperationRiskLevel, OperationConfirmation['confirmationType']> = {
        'READ_ONLY': 'NONE',
        'LOW_WRITE': 'SINGLE_CLICK',
        'MEDIUM_WRITE': 'SINGLE_CLICK',
        'HIGH_WRITE': 'DOUBLE_CONFIRM',
        'CRITICAL_WRITE': 'TWO_FACTOR',
    };

    return {
        operationId: `OP-${Date.now().toString(36)}`,
        riskLevel,
        description: `执行操作: ${operationType}`,
        impactScope: riskLevel === 'CRITICAL_WRITE' ? '可能影响电站运行安全' : '仅影响当前项目数据',
        requiredChecks: riskLevel === 'CRITICAL_WRITE'
            ? ['确认已通知现场人员', '确认已做好安全措施', '确认了解操作后果']
            : [],
        confirmationType: confirmationTypes[riskLevel],
        timeoutSeconds: riskLevel === 'CRITICAL_WRITE' ? 300 : undefined,
        reversible: riskLevel !== 'CRITICAL_WRITE',
        undoWindowSeconds: riskLevel === 'MEDIUM_WRITE' ? 30 : undefined,
    };
}
