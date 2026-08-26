// 配额查询 API

import { NextRequest, NextResponse } from 'next/server';
import { getAllQuotaUsage, getUserPlan, checkQuota, type QuotaType } from '@/lib/audit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

/**
 * GET /api/quota
 * 获取当前用户所有配额使用情况
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const plan = await getUserPlan(userId);
        const quotas = await getAllQuotaUsage(userId);

        return NextResponse.json({
            plan,
            quotas,
            upgradeUrl: plan === 'FREE' ? '/pricing' : null,
        });

    } catch (error) {
        console.error('Quota API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quota' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/quota/check
 * 检查指定操作是否有配额
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { quotaType, amount = 1 } = body;

        if (!quotaType) {
            return NextResponse.json({ error: 'Missing quotaType' }, { status: 400 });
        }

        const result = await checkQuota(session.user.id, quotaType as QuotaType, amount);

        return NextResponse.json({
            allowed: result.allowed,
            usage: result.usage,
            upgradeMessage: !result.allowed
                ? `${quotaType} 配额已用尽，升级到 Pro 获取更多额度`
                : null,
        });

    } catch (error) {
        console.error('Quota check error:', error);
        return NextResponse.json(
            { error: 'Failed to check quota' },
            { status: 500 }
        );
    }
}
