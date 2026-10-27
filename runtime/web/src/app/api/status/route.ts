import { NextResponse } from 'next/server';
import { readFileSync, statSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { readWechatConfig } from '@/lib/payments/wechat';

export async function GET() {
    let policyUpdatedAt: string | null = null;
    let policyCount: number | null = null;
    try {
        policyCount = await prisma.policy.count({ where: { reviewStatus: 'APPROVED' } });
        const latest = await prisma.policy.findFirst({ where: { reviewStatus: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
        policyUpdatedAt = latest?.updatedAt?.toISOString() ?? null;
    } catch {
        policyCount = null;
    }
    let heartbeat: { level: string; lastSeen: string | null; note: string } = { level: 'missing', lastSeen: null, note: '还没有心跳记录。' };
    const heartbeatFile = process.env.NENGJIAN_HEARTBEAT_FILE?.trim();
    if (heartbeatFile) {
        try {
            const payload = JSON.parse(readFileSync(heartbeatFile, 'utf8')) as { lastSeen?: string; acknowledgedAt?: string };
            const acked = payload.acknowledgedAt ? Date.parse(payload.acknowledgedAt) : NaN;
            const age = Number.isFinite(acked) ? Date.now() - acked : Number.POSITIVE_INFINITY;
            heartbeat = {
                level: age > 2 * 24 * 3600 * 1000 ? 'escalate' : 'ok',
                lastSeen: payload.lastSeen || null,
                note: age > 2 * 24 * 3600 * 1000 ? '心跳超过两日未确认，应升级通知。' : '心跳在两日确认窗口内。',
            };
        } catch {
            heartbeat = { level: 'missing', lastSeen: null, note: '心跳文件无法读取。' };
        }
    }
    const alipayConfigured = Boolean(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY);
    let wechatConfigured = false;
    try { wechatConfigured = readWechatConfig() !== null; } catch { wechatConfigured = false; }
    const domesticModel = Boolean(process.env.NENGJIAN_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.NENGJIAN_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.NENGJIAN_GLM_API_KEY || process.env.GLM_API_KEY);
    let cacheUpdatedAt: string | null = null;
    if (process.env.NENGJIAN_RESOURCE_CACHE) {
        try { cacheUpdatedAt = statSync(process.env.NENGJIAN_RESOURCE_CACHE).mtime.toISOString(); } catch { cacheUpdatedAt = null; }
    }
    return NextResponse.json({
        success: true,
        data: {
            api: 'ok',
            checkedAt: new Date().toISOString(),
            payments: { alipayConfigured, wechatConfigured, simulationInProduction: false },
            models: { domesticConfigured: domesticModel },
            policy: { approvedCount: policyCount, updatedAt: policyUpdatedAt },
            resourceCacheUpdatedAt: cacheUpdatedAt,
            heartbeat,
        },
    });
}
