import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { tierOf } from '@/lib/entitlements/access';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
    const tier = tierOf(user?.plan, user?.planExpireAt);
    if (!tier?.capabilities?.quarterly_brief) return NextResponse.json({ error: '季度简报从团队档开始提供' }, { status: 403 });
    const now = new Date();
    const count = await prisma.policy.count({
        where: {
            reviewStatus: 'APPROVED',
            AND: [
                { OR: [{ startDate: null }, { startDate: { lte: now } }] },
                { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            ],
        },
    });
    return NextResponse.json({
        success: true,
        data: {
            title: `新能源智库季度简报 ${now.getUTCFullYear()} Q${Math.floor(now.getUTCMonth() / 3) + 1}`,
            paragraphs: [
                `本季已审核且处于生效期的政策条目：${count} 条。`,
                '数据集里的价格列是结构样本，空值表示尚未载入已核验电价。',
                '本简报只汇总已审核政策条目和数据覆盖情况。',
            ],
        },
    });
}
