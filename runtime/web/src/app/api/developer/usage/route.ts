import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getApiStats } from '@/lib/api/open-api-middleware';

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

    // 获取统计数据
    const stats = getApiStats(keyId || undefined);

    // 模拟更详细的使用数据
    const usageData = {
        overview: {
            totalCalls: stats.total,
            callsLast24h: stats.last24h,
            avgLatency: `${stats.avgLatency.toFixed(1)}ms`,
            successRate: `${stats.successRate}%`,
            activeKeys: 2
        },

        byEndpoint: stats.byEndpoint.length > 0 ? stats.byEndpoint : [
            { endpoint: '/api/v1/projects', count: 125 },
            { endpoint: '/api/v1/projects/{id}/monitoring', count: 89 },
            { endpoint: '/api/v1/papers/search', count: 67 },
            { endpoint: '/api/v1/projects/{id}/analytics', count: 45 }
        ],

        byDay: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            calls: Math.floor(Math.random() * 200 + 50),
            errors: Math.floor(Math.random() * 10)
        })),

        byHour: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            calls: Math.floor(Math.random() * 50 + 10)
        })),

        errors: {
            total: 23,
            byType: [
                { code: 'RATE_LIMIT_EXCEEDED', count: 12 },
                { code: 'INVALID_API_KEY', count: 6 },
                { code: 'INSUFFICIENT_PERMISSIONS', count: 3 },
                { code: 'INTERNAL_ERROR', count: 2 }
            ]
        },

        quotas: {
            monthly: {
                limit: 10000,
                used: 3256,
                remaining: 6744,
                percentage: 32.56
            },
            rateLimit: {
                perMinute: 60,
                currentUsage: 12
            }
        }
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
