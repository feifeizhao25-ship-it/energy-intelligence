// 会员 API 中间件：登录校验 + 功能权限 + 每日额度（服务端扣减）。
//
// 原来 getCurrentUser 写死返回 null（「默认拒绝」的占位），于是用它包着的
// 风电 / 储能 / 光伏三个收益计算接口对所有人（包括付费会员）永远返回 401「请先登录」，
// 页面上点「计算」只会看到登录提示。现在读真实会话和数据库里的会员档。

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { FEATURE_ACCESS, Plan } from './plans';
import { consumeDaily, refundDaily, DAILY_FEATURE_NAME, type DailyFeature, type DailyStore, prismaDailyStore } from './daily-usage';
import { nextShanghaiMidnight } from './day';

export interface Member { id: string; plan: Plan }

export type FeatureKey = keyof typeof FEATURE_ACCESS;

export const featureLabels: Record<string, string> = {
    wind_calculation: '风电收益测算',
};

async function currentMember(): Promise<Member | null> {
    const session = await getServerSession(authOptions);
    const id = session?.user?.id;
    if (!id) return null;
    const user = await prisma.user.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, plan: true, planExpireAt: true },
    });
    if (!user) return null;
    return { id: user.id, plan: effectivePlan(user.plan, user.planExpireAt) as Plan };
}

function unauthorized() {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
}

export function featureDenied(plan: Plan, feature: FeatureKey): NextResponse | null {
    const allowed = FEATURE_ACCESS[feature] as readonly string[] | undefined;
    if (!allowed || allowed.includes(plan)) return null;
    return NextResponse.json(
        {
            error: 'FEATURE_NOT_AVAILABLE',
            message: `${featureLabels[feature] ?? '此功能'}需要升级会员`,
            requiredPlans: [...allowed],
            currentPlan: plan,
        },
        { status: 403 },
    );
}

export function usageDenied(feature: DailyFeature, limit: number, plan: Plan): NextResponse {
    return NextResponse.json(
        {
            error: 'USAGE_LIMIT_EXCEEDED',
            message: limit > 0
                ? `今日${DAILY_FEATURE_NAME[feature]}次数已用完（${limit} 次），请升级会员或等待明日 0 点重置`
                : `当前会员档不含${DAILY_FEATURE_NAME[feature]}功能，请升级会员`,
            limit,
            resetAt: nextShanghaiMidnight(new Date()).toISOString(),
            currentPlan: plan,
        },
        { status: 429 },
    );
}

/**
 * 组合：登录 → 功能权限（feature）→ 每日额度（usageType，先扣后做，业务失败则退还）。
 */
export async function withMembershipCheck(
    req: NextRequest,
    options: { feature?: FeatureKey; usageType?: DailyFeature },
    handler: (user: Member) => Promise<NextResponse>,
    deps: { member?: () => Promise<Member | null>; store?: DailyStore } = {},
): Promise<NextResponse> {
    void req;
    const user = await (deps.member ?? currentMember)();
    if (!user) return unauthorized();

    if (options.feature) {
        const denied = featureDenied(user.plan, options.feature);
        if (denied) return denied;
    }

    if (!options.usageType) return handler(user);

    const store = deps.store ?? prismaDailyStore;
    const taken = await consumeDaily(options.usageType, user.id, store);
    if (!taken.ok) {
        if (taken.reason === 'NO_USER') return unauthorized();
        return usageDenied(options.usageType, taken.limit, taken.plan);
    }
    let response: NextResponse;
    try {
        response = await handler(user);
    } catch (e) {
        await refundDaily(options.usageType, user.id, store).catch(() => undefined);
        throw e;
    }
    // 没有算出结果（4xx/5xx）不占用户额度
    if (!response.ok) await refundDaily(options.usageType, user.id, store).catch(() => undefined);
    return response;
}
