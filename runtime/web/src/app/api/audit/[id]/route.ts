// 审计页面 API
// 护城河：提供可审计、可复现的结果查询

import { NextRequest, NextResponse } from 'next/server';
import { getAuditRecord, verifyAuditRecord, getProjectAuditHistory } from '@/lib/audit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

/**
 * GET /api/audit/[id]
 * 获取单个审计记录（用于复现验证）
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // 🏰 护城河核心：审计记录应允许通过 ID 进行公开验证（Read-only）
        // 移除 session 检查，确保第三方机构或合作伙伴可以查验计算真实性

        const auditId = params.id;

        // 获取审计记录
        const record = await getAuditRecord(auditId);
        if (!record) {
            return NextResponse.json({ error: '审计记录不存在' }, { status: 404 });
        }

        // 验证完整性
        const verification = await verifyAuditRecord(auditId);

        return NextResponse.json({
            record,
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
        console.error('Audit API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch audit record' },
            { status: 500 }
        );
    }
}
