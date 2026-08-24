import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API 使用统计
 * 
 * GET /api/developer/usage
 * 
 * 获取 API 调用统计数据
 */

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    const userId = session.user.id;

    const url = new URL(req.url);
    const keyId = url.searchParams.get('keyId');
    const period = url.searchParams.get('period') || '24h';

    const keyFilter = keyId ? { apiKeyId: keyId } : {};
    if (keyId && !(await prisma.apiKey.findFirst({ where: { id: keyId, userId }, select: { id: true } }))) {
        return NextResponse.json({ error: 'API_KEY_NOT_FOUND' }, { status: 404 });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [logs, activeKeys] = await Promise.all([
        prisma.apiLog.findMany({ where: { userId, ...keyFilter }, orderBy: { createdAt: 'desc' }, take: 10000 }),
        prisma.apiKey.count({ where: { userId, status: 'ACTIVE' } }),
    ]);
    const recent = logs.filter(log => log.createdAt >= since);
    const endpointCounts = new Map<string, number>();
    for (const log of recent) endpointCounts.set(log.endpoint, (endpointCounts.get(log.endpoint) || 0) + 1);
    const avgLatency = recent.length ? recent.reduce((sum, log) => sum + log.duration, 0) / recent.length : 0;
    const successRate = recent.length ? recent.filter(log => log.status < 400).length / recent.length * 100 : 0;

    const usageData = {
        overview: {
            totalCalls: logs.length,
            callsLast24h: recent.length,
            avgLatency: `${avgLatency.toFixed(1)}ms`,
            successRate: `${successRate.toFixed(1)}%`,
            activeKeys
        },
        byEndpoint: [...endpointCounts.entries()].map(([endpoint, count]) => ({ endpoint, count })).sort((a, b) => b.count - a.count),
    };

    return NextResponse.json({
        success: true,
        data: usageData,
        meta: {
            timestamp: new Date().toISOString(),
            period,
            userId
        }
    });
}
