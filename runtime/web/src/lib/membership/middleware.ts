// 会员API中间件 - 集成权限检查和使用量统计

import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureAccess, checkUsageLimit, shouldResetDailyUsage, getEffectivePlan } from './permissions';
import type { User } from './permissions';

// 该旧中间件尚未接入生产会话与持久化用量。必须默认拒绝，不能用
// 示例用户绕过身份认证或伪造会员用量。新接口应使用 `@/lib/auth`。
async function getCurrentUser(req: NextRequest): Promise<User | null> {
    void req;
    return null;
}

async function updateUserUsage(userId: string, feature: string, increment: number = 1): Promise<void> {
    throw new Error(`旧会员中间件未接入持久化用量：${userId}/${feature}/${increment}`);
}

async function resetDailyUsage(userId: string): Promise<void> {
    throw new Error(`旧会员中间件未接入每日用量重置：${userId}`);
}

/**
 * 检查功能访问权限的中间件
 */
export async function withFeatureAccess(
    req: NextRequest,
    feature: string,
    handler: (user: User) => Promise<NextResponse>
): Promise<NextResponse> {
    const user = await getCurrentUser(req);

    if (!user) {
        return NextResponse.json(
            { error: 'UNAUTHORIZED', message: '请先登录' },
            { status: 401 }
        );
    }

    // 检查功能权限
    const access = checkFeatureAccess(user, feature as any);

    if (!access.allowed) {
        return NextResponse.json(
            {
                error: 'FEATURE_NOT_AVAILABLE',
                message: access.message,
                requiredPlans: access.requiredPlans,
                currentPlan: getEffectivePlan(user),
            },
            { status: 403 }
        );
    }

    return handler(user);
}

/**
 * 检查使用限额的中间件
 */
export async function withUsageLimit(
    req: NextRequest,
    feature: string,
    handler: (user: User) => Promise<NextResponse>
): Promise<NextResponse> {
    const user = await getCurrentUser(req);

    if (!user) {
        return NextResponse.json(
            { error: 'UNAUTHORIZED', message: '请先登录' },
            { status: 401 }
        );
    }

    // 检查是否需要重置每日使用量
    if (shouldResetDailyUsage(user)) {
        await resetDailyUsage(user.id);
        // 重置后重新获取用户数据
        user.dailyAiCalls = 0;
        user.dailyResourceQueries = 0;
        user.dailyCalculations = 0;
        user.dailyPaperSearches = 0;
        user.dailyDiagnoses = 0;
        user.lastResetAt = new Date();
    }

    // 检查使用限额
    const check = checkUsageLimit(user, feature as any);

    if (!check.allowed) {
        return NextResponse.json(
            {
                error: 'USAGE_LIMIT_EXCEEDED',
                message: check.message,
                limit: check.limit,
                remaining: check.remaining,
                resetAt: check.resetAt,
                currentPlan: getEffectivePlan(user),
            },
            { status: 429 }
        );
    }

    // 执行请求
    const response = await handler(user);

    // 如果请求成功，增加使用量
    if (response.ok) {
        await updateUserUsage(user.id, feature);
    }

    // 在响应头中添加使用情况
    response.headers.set('X-RateLimit-Limit', check.limit.toString());
    response.headers.set('X-RateLimit-Remaining', check.remaining.toString());
    if (check.resetAt) {
        response.headers.set('X-RateLimit-Reset', check.resetAt.toISOString());
    }

    return response;
}

/**
 * 组合功能权限和使用限额检查
 */
export async function withMembershipCheck(
    req: NextRequest,
    options: {
        feature?: string;
        usageType?: string;
    },
    handler: (user: User) => Promise<NextResponse>
): Promise<NextResponse> {
    const user = await getCurrentUser(req);

    if (!user) {
        return NextResponse.json(
            { error: 'UNAUTHORIZED', message: '请先登录' },
            { status: 401 }
        );
    }

    // 检查功能权限（如果指定）
    if (options.feature) {
        const access = checkFeatureAccess(user, options.feature as any);
        if (!access.allowed) {
            return NextResponse.json(
                {
                    error: 'FEATURE_NOT_AVAILABLE',
                    message: access.message,
                    requiredPlans: access.requiredPlans,
                    currentPlan: getEffectivePlan(user),
                },
                { status: 403 }
            );
        }
    }

    // 检查使用限额（如果指定）
    if (options.usageType) {
        // 检查是否需要重置每日使用量
        if (shouldResetDailyUsage(user)) {
            await resetDailyUsage(user.id);
            user.dailyAiCalls = 0;
            user.dailyResourceQueries = 0;
            user.dailyCalculations = 0;
            user.dailyPaperSearches = 0;
            user.dailyDiagnoses = 0;
            user.lastResetAt = new Date();
        }

        const check = checkUsageLimit(user, options.usageType as any);
        if (!check.allowed) {
            return NextResponse.json(
                {
                    error: 'USAGE_LIMIT_EXCEEDED',
                    message: check.message,
                    limit: check.limit,
                    remaining: check.remaining,
                    resetAt: check.resetAt,
                    currentPlan: getEffectivePlan(user),
                },
                { status: 429 }
            );
        }

        // 执行请求
        const response = await handler(user);

        // 如果请求成功，增加使用量
        if (response.ok) {
            await updateUserUsage(user.id, options.usageType);
        }

        // 添加响应头
        response.headers.set('X-RateLimit-Limit', check.limit.toString());
        response.headers.set('X-RateLimit-Remaining', check.remaining.toString());
        if (check.resetAt) {
            response.headers.set('X-RateLimit-Reset', check.resetAt.toISOString());
        }

        return response;
    }

    // 没有指定检查项，直接执行
    return handler(user);
}

/**
 * 使用示例：
 * 
 * // 在API路由中使用
 * export async function GET(req: NextRequest) {
 *   return withMembershipCheck(
 *     req,
 *     { 
 *       feature: 'monthly_data',  // 检查功能权限
 *       usageType: 'resource_query'  // 检查使用限额
 *     },
 *     async (user) => {
 *       // 执行业务逻辑
 *       const data = await fetchResourceData();
 *       return NextResponse.json(data);
 *     }
 *   );
 * }
 */
