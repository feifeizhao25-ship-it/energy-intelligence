/**
 * 可复现计算结果格式
 *  * 核心思想：所有计算输出统一格式，保证：
 * - 可审计
 * - 可复现
 * - 可交付
 * - 质量可控
 */

import { EvidenceChain, ReproduceCommand } from './evidence-chain';
import { AssumptionManager } from './assumption-manager';
import crypto from 'crypto';

/**
 * 质量标签
 * - PREVIEW: 预览级，快速估算，may have shortcuts
 * - STANDARD: 标准级，常规使用，符合行业标准
 * - AUDIT_GRADE: 审计级，最高质量，可用于银行贷款/政府审批
 */
export type QualityTag = "PREVIEW" | "STANDARD" | "AUDIT_GRADE";

/**
 * 审计元数据
 */
export interface AuditMeta {
    /** 结果ID */
    id: string;

    /** 计算引擎版本 */
    version: string;

    /** 口径版本 */
    assumptionVersion: string;

    /** 执行时间 */
    executedAt: Date;

    /** 是否可复现 */
    reproducible: boolean;

    /** 质量标签 */
    qualityTag: QualityTag;

    /** 结果哈希（用于验证）*/
    hash: string;
}

/**
 * 交付物引用
 */
export interface DeliverableReference {
    /** 报告ID */
    reportId?: string;

    /** PDF下载URL */
    pdfUrl?: string;

    /** Excel下载URL */
    excelUrl?: string;

    /** JSON数据URL */
    jsonUrl?: string;
}

/**
 * 统一的计算结果格式
 */
export interface CalculationResult<T = any> {
    /** 核心结果数据 */
    result: T;

    /** 审计元数据 */
    auditMeta: AuditMeta;

    /** 证据链 */
    evidence: EvidenceChain;

    /** 可复现命令 */
    reproduceCommand: ReproduceCommand;

    /** 交付物引用 */
    deliverables?: DeliverableReference;

    /** 创建时间 */
    createdAt: Date;
}

/**
 * 太阳能计算结果（示例）
 */
export interface SolarCalculationData {
    /** 25年总发电量 (kWh) */
    totalGeneration: number;

    /** 年均发电量 (kWh) */
    annualGeneration: number;

    /** 25年总收益 (元) */
    totalRevenue: number;

    /** IRR (%) */
    irr: number;

    /** NPV (元) */
    npv: number;

    /** LCOE (元/kWh) */
    lcoe: number;

    /** 静态投资回收期 (年) */
    paybackPeriod: number;

    /** 年度现金流 */
    cashFlow: Array<{
        year: number;
        generation: number;
        revenue: number;
        cost: number;
        netCashFlow: number;
    }>;
}

/**
 * 诊断结果（示例）
 */
export interface DiagnosticData {
    /** PR值 */
    pr: number;

    /** 诊断等级 */
    grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

    /** 发现的问题 */
    issues: Array<{
        type: string;
        severity: "HIGH" | "MEDIUM" | "LOW";
        description: string;
        estimatedLoss: number; // kWh
        recommendation: string;
    }>;

    /** 停机损失 (元) */
    downtimeLoss: number;

    /** 建议措施 */
    recommendations: string[];
}

/**
 * 结果构建器
 */
export class ResultBuilder<T> {
    private result: Partial<CalculationResult<T>>;

    constructor(
        data: T,
        engine: string,
        version: string,
        qualityTag: QualityTag = "STANDARD"
    ) {
        const assumptionVersion = AssumptionManager.getCurrentVersion().id;
        const id = this.generateId();

        this.result = {
            result: data,
            auditMeta: {
                id,
                version: `${engine}@${version}`,
                assumptionVersion,
                executedAt: new Date(),
                reproducible: true,
                qualityTag,
                hash: "" // 稍后计算
            },
            createdAt: new Date()
        };
    }

    /**
     * 设置证据链
     */
    setEvidence(evidence: EvidenceChain): this {
        this.result.evidence = evidence;
        return this;
    }

    /**
     * 设置可复现命令
     */
    setReproduceCommand(command: ReproduceCommand): this {
        this.result.reproduceCommand = command;
        return this;
    }

    /**
     * 设置交付物
     */
    setDeliverables(deliverables: DeliverableReference): this {
        this.result.deliverables = deliverables;
        return this;
    }

    /**
     * 构建最终结果
     */
    build(): CalculationResult<T> {
        if (!this.result.evidence) {
            throw new Error("Evidence chain is required");
        }

        if (!this.result.reproduceCommand) {
            throw new Error("Reproduce command is required");
        }

        // 计算哈希
        this.result.auditMeta!.hash = this.calculateHash();

        return this.result as CalculationResult<T>;
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 计算结果哈希
     */
    private calculateHash(): string {
        const content = JSON.stringify({
            result: this.result.result,
            assumptionVersion: this.result.auditMeta!.assumptionVersion,
            evidence: this.result.evidence?.conclusionId
        });

        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }
}

/**
 * 结果验证器
 */
export class ResultValidator {
    /**
     * 验证结果完整性
     */
    static validate<T>(result: CalculationResult<T>): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // 检查必需字段
        if (!result.result) {
            errors.push("缺少计算结果数据");
        }

        if (!result.auditMeta) {
            errors.push("缺少审计元数据");
        }

        if (!result.evidence) {
            errors.push("缺少证据链");
        }

        if (!result.reproduceCommand) {
            errors.push("缺少可复现命令");
        }

        // 检查审计级质量要求
        if (result.auditMeta?.qualityTag === "AUDIT_GRADE") {
            if (!result.evidence?.uncertaintyAnalysis) {
                errors.push("审计级结果必须包含不确定性分析");
            }

            if (!result.deliverables) {
                warnings.push("审计级结果建议包含交付物");
            }

            if (!result.evidence?.regulatoryCompliance ||
                result.evidence.regulatoryCompliance.length === 0) {
                errors.push("审计级结果必须引用合规标准");
            }
        }

        // 检查哈希
        if (result.auditMeta?.hash) {
            const expectedHash = this.recalculateHash(result);
            if (expectedHash !== result.auditMeta.hash) {
                errors.push("结果哈希不匹配，数据可能被篡改");
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * 重新计算哈希以验证
     */
    static recalculateHash<T>(result: CalculationResult<T>): string {
        const content = JSON.stringify({
            result: result.result,
            assumptionVersion: result.auditMeta.assumptionVersion,
            evidence: result.evidence.conclusionId
        });

        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }

    /**
     * 比较两个结果
     */
    static compare<T>(
        resultA: CalculationResult<T>,
        resultB: CalculationResult<T>
    ): {
        identical: boolean;
        differences: string[];
    } {
        const differences: string[] = [];

        // 比较口径版本
        if (resultA.auditMeta.assumptionVersion !== resultB.auditMeta.assumptionVersion) {
            differences.push(
                `口径版本不同: ${resultA.auditMeta.assumptionVersion} vs ` +
                `${resultB.auditMeta.assumptionVersion}`
            );
        }

        // 比较哈希
        if (resultA.auditMeta.hash !== resultB.auditMeta.hash) {
            differences.push("结果哈希不同，数据内容不一致");
        }

        // 比较证据链
        if (resultA.evidence.conclusionId !== resultB.evidence.conclusionId) {
            differences.push("证据链ID不同");
        }

        return {
            identical: differences.length === 0,
            differences
        };
    }
}

/**
 * 质量标签辅助函数
 */
export class QualityTagHelper {
    /**
     * 获取质量标签描述
     */
    static getDescription(tag: QualityTag): string {
        const descriptions = {
            PREVIEW: "预览级 - 快速估算，仅供参考",
            STANDARD: "标准级 - 符合行业标准，常规使用",
            AUDIT_GRADE: "审计级 - 最高质量，可用于银行贷款/政府审批"
        };
        return descriptions[tag];
    }

    /**
     * 获取质量要求
     */
    static getRequirements(tag: QualityTag): string[] {
        const requirements = {
            PREVIEW: [
                "基本数据完整",
                "计算逻辑正确"
            ],
            STANDARD: [
                "完整证据链",
                "口径版本明确",
                "合规标准引用"
            ],
            AUDIT_GRADE: [
                "完整证据链",
                "不确定性分析",
                "合规标准引用",
                "可复现验证",
                "标准化交付物"
            ]
        };
        return requirements[tag];
    }

    /**
     * 判断结果是否满足质量要求
     */
    static meetsRequirements<T>(
        result: CalculationResult<T>,
        requiredTag: QualityTag
    ): boolean {
        const validation = ResultValidator.validate(result);

        if (!validation.valid) {
            return false;
        }

        const tagLevels = {
            PREVIEW: 1,
            STANDARD: 2,
            AUDIT_GRADE: 3
        };

        return tagLevels[result.auditMeta.qualityTag] >= tagLevels[requiredTag];
    }
}

/**
 * 使用示例：
 * 
 * // 构建计算结果
 * const solarData: SolarCalculationData = {
 *   totalGeneration: 3500000,
 *   annualGeneration: 140000,
 *   totalRevenue: 1800000,
 *   irr: 8.5,
 *   npv: 450000,
 *   lcoe: 0.35,
 *   paybackPeriod: 7.2,
 *   cashFlow: [...]
 * };
 * 
 * const result = new ResultBuilder(solarData, "solar-calculator", "2.1.0", "AUDIT_GRADE")
 *   .setEvidence(evidenceChain)
 *   .setReproduceCommand(reproduceCmd)
 *   .setDeliverables({ pdfUrl: "/reports/solar-001.pdf" })
 *   .build();
 * 
 * // 验证结果
 * const validation = ResultValidator.validate(result);
 * if (!validation.valid) {
 *   console.error("验证失败:", validation.errors);
 * }
 * 
 * // 检查质量
 * const meetsAuditGrade = QualityTagHelper.meetsRequirements(result, "AUDIT_GRADE");
 * console.log("满足审计级要求:", meetsAuditGrade); 
 */
