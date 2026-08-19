// 会员API中间件 - 集成权限检查和使用量统计

import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureAccess, checkUsageLimit, shouldResetDailyUsage, getEffectivePlan } from './permissions';
import type { User } from './permissions';
import { Plan } from './plans';

// Mock函数 - 实际应该从数据库获取
async function getCurrentUser(req: NextRequest): Promise<User | null> {
    // TODO: 实现真实的用户认证逻辑
    // 这里应该从session/JWT中获取用户信息

    // 示例用户
    return {
        id: 'user_123',
        plan: Plan.FREE,
        planExpireAt: undefined,
        dailyAiCalls: 0,
        dailyResourceQueries: 0,
        dailyCalculations: 0,
        dailyPaperSearches: 0,
        dailyDiagnoses: 0,
        projectCount: 0,
        paperCount: 0,
        stationCount: 0,
        folderCount: 0,
        lastResetAt: new Date(),
    };
}

async function updateUserUsage(userId: string, feature: string, increment: number = 1): Promise<void> {
    // TODO: 更新数据库中的使用量
    console.log(`Incrementing ${feature} for user ${userId} by ${increment}`);
}

async function resetDailyUsage(userId: string): Promise<void> {
    // TODO: 重置数据库中的每日使用量
    console.log(`Resetting daily usage for user ${userId}`);
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
