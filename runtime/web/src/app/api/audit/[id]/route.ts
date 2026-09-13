// 审计页面 API
// 护城河：提供可审计、可复现的结果查询

import { NextRequest, NextResponse } from 'next/server';
import { getAuditRecord, verifyAuditRecord } from '@/lib/audit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

/**
 * GET /api/audit/[id]
 * 获取单个审计记录（用于复现验证）
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return respond(401, { error: '请先登录' });

        const auditId = params.id;

        // 获取审计记录
        const record = await getAuditRecord(auditId);
        if (!record || record.userId !== session.user.id) {
            return respond(404, { error: '计算记录不存在或无法访问' });
        }

        // 验证完整性
        const verification = await verifyAuditRecord(auditId);

        const { ipAddress, userAgent, userId, orgId, ...visibleRecord } = record;
        return respond(200, {
            record: visibleRecord,
            verification,
            reproducibilityInfo: {
                calcVersion: record.versionMeta.calcVersion,
                assumptionVersion: record.versionMeta.assumptionVersion,
                timestamp: record.createdAt,
                dataSources: record.evidences.map(e => ({
                    source: e.sourceName,
                    type: e.sourceType,
                    fetchedAt: e.fetchedAt,
                })),
                calibrations: record.calibrations,
            },
        });

    } catch (error) {
        return respond(503, { error: '计算记录暂时无法读取，请稍后重试' });
    }
}

function respond(status: number, body: object) {
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
