// 成本与配额系统
// 护城河：AI调用、诊断次数、导出次数的配额管理

import { prisma } from '@/lib/prisma';

/**
 * 配额类型
 */
export type QuotaType =
    | 'AI_CALLS'           // AI调用次数
    | 'CALCULATIONS'       // 收益测算次数
    | 'DIAGNOSES'          // 诊断分析次数
    | 'EXPORTS'            // 报告导出次数
    | 'PAPER_SEARCHES'     // 论文搜索次数
    | 'PAPER_SUMMARIES'    // AI论文摘要次数
    | 'STATION_RECORDS'    // 电站记录条数
    | 'PROJECTS'           // 项目数量
    | 'API_CALLS'          // API调用次数（开放API）
    | 'STORAGE_MB'         // 存储空间（MB）
    ;

/**
 * 套餐类型
 */
export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';

/**
 * 配额限制配置
 */
export const QUOTA_LIMITS: Record<PlanType, Record<QuotaType, number>> = {
    FREE: {
        AI_CALLS: 20,           // 每天20次
        CALCULATIONS: 5,         // 每天5次
        DIAGNOSES: 2,            // 每天2次
        EXPORTS: 1,              // 每天1次
        PAPER_SEARCHES: 10,      // 每天10次
        PAPER_SUMMARIES: 3,      // 每天3次
        STATION_RECORDS: 30,     // 总共30条
        PROJECTS: 3,             // 总共3个项目
        API_CALLS: 0,            // 不开放
        STORAGE_MB: 100,         // 100MB
    },
    PRO: {
        AI_CALLS: 500,           // 每天500次
        CALCULATIONS: 100,       // 每天100次
        DIAGNOSES: 50,           // 每天50次
        EXPORTS: 20,             // 每天20次
        PAPER_SEARCHES: 200,     // 每天200次
        PAPER_SUMMARIES: 50,     // 每天50次
        STATION_RECORDS: 10000,  // 总共10000条
        PROJECTS: 50,            // 总共50个项目
        API_CALLS: 1000,         // 每天1000次
        STORAGE_MB: 5000,        // 5GB
    },
    ENTERPRISE: {
        AI_CALLS: -1,            // 无限
        CALCULATIONS: -1,        // 无限
        DIAGNOSES: -1,           // 无限
        EXPORTS: -1,             // 无限
        PAPER_SEARCHES: -1,      // 无限
        PAPER_SUMMARIES: -1,     // 无限
        STATION_RECORDS: -1,     // 无限
        PROJECTS: -1,            // 无限
        API_CALLS: -1,           // 无限
        STORAGE_MB: -1,          // 无限
    },
};

/**
 * 配额重置周期
 */
export const QUOTA_RESET_PERIOD: Record<QuotaType, 'DAILY' | 'MONTHLY' | 'TOTAL'> = {
    AI_CALLS: 'DAILY',
    CALCULATIONS: 'DAILY',
    DIAGNOSES: 'DAILY',
    EXPORTS: 'DAILY',
    PAPER_SEARCHES: 'DAILY',
    PAPER_SUMMARIES: 'DAILY',
    STATION_RECORDS: 'TOTAL',
    PROJECTS: 'TOTAL',
    API_CALLS: 'DAILY',
    STORAGE_MB: 'TOTAL',
};

/**
 * 配额使用状态
 */
export interface QuotaUsage {
    type: QuotaType;
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    resetsAt?: string;
    exceeded: boolean;
}

/**
 * 获取用户套餐
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { plan: true },
        });
        return (user?.plan as PlanType) || 'FREE';
    } catch {
        return 'FREE';
    }
}

/**
 * 获取配额使用情况
 */
export async function getQuotaUsage(
    userId: string,
    quotaType: QuotaType
): Promise<QuotaUsage> {
    const plan = await getUserPlan(userId);
    const limit = QUOTA_LIMITS[plan][quotaType];
    const period = QUOTA_RESET_PERIOD[quotaType];

    // 无限配额
    if (limit === -1) {
        return {
            type: quotaType,
            used: 0,
            limit: -1,
            remaining: -1,
            percentage: 0,
            exceeded: false,
        };
    }

    // 获取使用量
    let used = 0;
    try {
        const startOfPeriod = period === 'DAILY'
            ? new Date(new Date().setHours(0, 0, 0, 0))
            : period === 'MONTHLY'
                ? new Date(new Date().setDate(1))
                : new Date(0);

        const usage = await prisma.quotaUsage.findFirst({
            where: {
                userId,
                type: quotaType,
                periodStart: { gte: startOfPeriod },
            },
        });
        used = usage?.count || 0;
    } catch {
        used = 0;
    }

    const remaining = Math.max(0, limit - used);
    const percentage = Math.min(100, Math.round((used / limit) * 100));

    // 计算重置时间
    let resetsAt: string | undefined;
    if (period === 'DAILY') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        resetsAt = tomorrow.toISOString();
    } else if (period === 'MONTHLY') {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        resetsAt = nextMonth.toISOString();
    }

    return {
        type: quotaType,
        used,
        limit,
        remaining,
        percentage,
        resetsAt,
        exceeded: used >= limit,
    };
}

/**
 * 检查配额是否足够
 */
export async function checkQuota(
    userId: string,
    quotaType: QuotaType,
    amount: number = 1
): Promise<{ allowed: boolean; usage: QuotaUsage }> {
    const usage = await getQuotaUsage(userId, quotaType);

    if (usage.limit === -1) {
        return { allowed: true, usage };
    }

    const allowed = usage.remaining >= amount;
    return { allowed, usage };
}

/**
 * 消耗配额
 */
export async function consumeQuota(
    userId: string,
    quotaType: QuotaType,
    amount: number = 1
): Promise<{ success: boolean; usage: QuotaUsage }> {
    const { allowed, usage } = await checkQuota(userId, quotaType, amount);

    if (!allowed) {
        return { success: false, usage };
    }

    const period = QUOTA_RESET_PERIOD[quotaType];
    const startOfPeriod = period === 'DAILY'
        ? new Date(new Date().setHours(0, 0, 0, 0))
        : period === 'MONTHLY'
            ? new Date(new Date().setDate(1))
            : new Date(0);

    try {
        await prisma.quotaUsage.upsert({
            where: {
                userId_type_periodStart: {
                    userId,
                    type: quotaType,
                    periodStart: startOfPeriod,
                },
            },
            update: {
                count: { increment: amount },
            },
            create: {
                userId,
                type: quotaType,
                count: amount,
                periodStart: startOfPeriod,
            },
        });

        const newUsage = await getQuotaUsage(userId, quotaType);
        return { success: true, usage: newUsage };
    } catch (error) {
        console.error('Failed to consume quota:', error);
        return { success: false, usage };
    }
}

/**
 * 获取用户所有配额状态
 */
export async function getAllQuotaUsage(userId: string): Promise<QuotaUsage[]> {
    const quotaTypes: QuotaType[] = [
        'AI_CALLS',
        'CALCULATIONS',
        'DIAGNOSES',
        'EXPORTS',
        'PAPER_SEARCHES',
        'PAPER_SUMMARIES',
        'PROJECTS',
        'API_CALLS',
    ];

    return Promise.all(quotaTypes.map(type => getQuotaUsage(userId, type)));
}

/**
 * 配额检查中间件
 */
export function createQuotaMiddleware(quotaType: QuotaType) {
    return async function quotaMiddleware(
        userId: string,
        next: () => Promise<void>
    ): Promise<{ success: boolean; error?: string; usage?: QuotaUsage }> {
        const { allowed, usage } = await checkQuota(userId, quotaType);

        if (!allowed) {
            return {
                success: false,
                error: `${quotaType} 配额已用尽，请升级套餐或等待重置`,
                usage,
            };
        }

        await next();
        await consumeQuota(userId, quotaType);

        return { success: true, usage };
    };
}
