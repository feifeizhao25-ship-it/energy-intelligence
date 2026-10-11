import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { USAGE_LIMITS } from '@/lib/membership/plans';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { sameShanghaiDay } from '@/lib/membership/day';
import { buildPersonalDashboard } from '@/lib/dashboard/personal-summary';
import { buildPersonalization, parsePreferences, PREFERENCE_LOG_TYPES, dedupeNextActions } from '@/lib/dashboard/personalization';
import { TIP_DISMISS_DAYS, TIP_DISMISSED_TYPE } from '@/lib/dashboard/tips';

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

    const now = new Date();
    const [projects, projectCount, calculationCount, savedPaperCount, stations, prefLog, policies, dismissedLogs] = await Promise.all([
        prisma.project.findMany({
            where: { userId }, orderBy: { updatedAt: 'desc' }, take: 5,
            select: { id: true, name: true, type: true, capacity: true, reportStatus: true, updatedAt: true, location: true },
        }),
        prisma.project.count({ where: { userId } }),
        prisma.calculation.count({ where: { userId } }),
        prisma.savedPaper.count({ where: { userId } }),
        prisma.station.findMany({ where: { userId }, select: { id: true, name: true, status: true, lastUpdated: true } }),
        // 个性化偏好：设置页或引导页保存的最新一条
        prisma.usageLog.findFirst({
            where: { userId, type: { in: [...PREFERENCE_LOG_TYPES] } }, orderBy: { date: 'desc' }, select: { metadata: true },
        }),
        // 只用人工审核通过的政策（省份过滤在 buildPersonalization 里做）
        prisma.policy.findMany({
            where: { reviewStatus: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, take: 200,
            select: { id: true, region: true, type: true, value: true, unit: true, sourceTitle: true, docNumber: true, sourceUrl: true, publishedAt: true, startDate: true, endDate: true },
        }),
        // 用户点过「不再提示」的提示（30 天内不再出现）
        prisma.usageLog.findMany({
            where: { userId, type: TIP_DISMISSED_TYPE, date: { gte: new Date(now.getTime() - TIP_DISMISS_DAYS * 86_400_000) } },
            select: { metadata: true },
        }),
    ]);
    const dismissedTips = dismissedLogs.map(l => (l.metadata as { tipId?: unknown } | null)?.tipId).filter((v): v is string => typeof v === 'string');

    const sameDay = user.lastResetAt && sameShanghaiDay(new Date(user.lastResetAt), now);
    const plan = effectivePlan(user.plan, user.planExpireAt, now) as keyof typeof USAGE_LIMITS;
    const limits = USAGE_LIMITS[plan] ?? USAGE_LIMITS.FREE;
    const usageToday: Record<string, number> = sameDay ? {
        'AI 对话': user.dailyAiCalls, '收益测算': user.dailyCalculations,
        '文献检索': user.dailyPaperSearches, '资源查询': user.dailyResourceQueries,
    } : {};

    const dashboard = buildPersonalDashboard({
            user: { name: user.name, plan: user.plan, planExpireAt: user.planExpireAt },
            projects: projects.map(({ location: _location, ...p }) => p), projectCount, calculationCount, savedPaperCount, stations,
            usageToday,
            limits: {
                'AI 对话': limits.ai_chat, '收益测算': limits.calculation,
                '文献检索': limits.paper_search, '资源查询': limits.resource_query,
            },
            now,
            dismissedTips,
            userId,
        });
    // 个性化对免费用户同样生效（不按会员档区分）
    const personalization = buildPersonalization({
        prefs: prefLog ? parsePreferences(prefLog.metadata) : null,
        projectLocations: projects.map(p => p.location),
        projectTypes: projects.map(p => p.type),
        hasStationAlerts: dashboard.stationAlerts.length > 0,
        policies,
        now,
    });

    return NextResponse.json({
        success: true,
        data: { ...dashboard, nextActions: dedupeNextActions(dashboard.nextActions, personalization.focus), personalization },
    });
}
