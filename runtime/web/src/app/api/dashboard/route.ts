import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { USAGE_LIMITS } from '@/lib/membership/plans';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { buildPersonalDashboard } from '@/lib/dashboard/personal-summary';

export const dynamic = 'force-dynamic';

/** 当前用户自己的工作台数据。原来一律 503，页面改为展示演示人设。 */
export async function GET() {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            name: true, plan: true, planExpireAt: true, lastResetAt: true,
            dailyAiCalls: true, dailyCalculations: true, dailyPaperSearches: true, dailyResourceQueries: true,
        },
    });
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const [projects, projectCount, calculationCount, savedPaperCount, stations] = await Promise.all([
        prisma.project.findMany({
            where: { userId }, orderBy: { updatedAt: 'desc' }, take: 5,
            select: { id: true, name: true, type: true, capacity: true, reportStatus: true, updatedAt: true },
        }),
        prisma.project.count({ where: { userId } }),
        prisma.calculation.count({ where: { userId } }),
        prisma.savedPaper.count({ where: { userId } }),
        prisma.station.findMany({ where: { userId }, select: { id: true, name: true, status: true, lastUpdated: true } }),
    ]);

    const now = new Date();
    const sameDay = user.lastResetAt && new Date(user.lastResetAt).toDateString() === now.toDateString();
    const plan = effectivePlan(user.plan, user.planExpireAt, now) as keyof typeof USAGE_LIMITS;
    const limits = USAGE_LIMITS[plan] ?? USAGE_LIMITS.FREE;
    const usageToday: Record<string, number> = sameDay ? {
        'AI 对话': user.dailyAiCalls, '收益测算': user.dailyCalculations,
        '文献检索': user.dailyPaperSearches, '资源查询': user.dailyResourceQueries,
    } : {};

    return NextResponse.json({
        success: true,
        data: buildPersonalDashboard({
            user: { name: user.name, plan: user.plan, planExpireAt: user.planExpireAt },
            projects, projectCount, calculationCount, savedPaperCount, stations,
            usageToday,
            limits: {
                'AI 对话': limits.ai_chat, '收益测算': limits.calculation,
                '文献检索': limits.paper_search, '资源查询': limits.resource_query,
            },
            now,
        }),
    });
}
