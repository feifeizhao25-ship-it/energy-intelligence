import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { tierOf } from '@/lib/entitlements/access';
import resources from '@/data/domestic-resources.json';
import { neutralizeCnText } from '@/lib/compliance/bottom-line';

async function policyCount(now: Date): Promise<string> {
    try {
        const count = await prisma.policy.count({
            where: {
                reviewStatus: 'APPROVED',
                AND: [
                    { OR: [{ startDate: null }, { startDate: { lte: now } }] },
                    { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                ],
            },
        });
        return String(count);
    } catch {
        return '—';
    }
}

export async function GET() {
    const preview = process.env.NENGJIAN_SCREENSHOT === '1';
    if (!preview) {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
        const tier = tierOf(user?.plan, user?.planExpireAt);
        if (!tier?.capabilities?.quarterly_brief) return NextResponse.json({ error: '季度简报从团队档开始提供' }, { status: 403 });
    }
    const now = new Date();
    const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
    const count = await policyCount(now);
    const stations = (resources.stations || []).length;
    const paragraphs = [
        preview ? '这是预览稿，不是对外发布。' : '本简报只汇总已审核条目和覆盖情况。',
        `统计区间：${now.getUTCFullYear()} 年第 ${quarter} 季度（按 UTC 季度，展示时区为 Asia/Shanghai 的发布日历）。`,
        `已审核且处于生效期的政策条目：${count} 条。来源是本站政策库，未连接时显示为横线。`,
        `省级城市气候样本 ${stations} 个。数值是离线样本，不是 NASA POWER 实测。`,
        '省级代理购电价格只在载入带来源链接和日期的记录后出现。没有这类记录时不填金额。',
        '政策正文、生效日期和适用期以发布机关原文为准。本简报不代替原文。',
    ].map((paragraph) => neutralizeCnText(paragraph));
    return NextResponse.json({
        success: true,
        data: {
            title: `新能源智库季度简报 ${now.getUTCFullYear()} Q${quarter}`,
            paragraphs,
            preview,
        },
    });
}
