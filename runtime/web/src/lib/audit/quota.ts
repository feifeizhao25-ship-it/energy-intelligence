// 成本与配额系统
// 护城河：AI调用、诊断次数、导出次数的配额管理

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { startOfShanghaiDay, nextShanghaiMidnight } from '@/lib/membership/day';
import registry from '@/lib/entitlements/entitlements.json';

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
export type PlanType = 'FREE' | 'PRO' | 'MAINTENANCE' | 'FULL' | 'TEAM' | 'ENTERPRISE';

/**
 * 配额限制配置
 */
const LEGACY_LIMITS: Record<string, Record<QuotaType, number>> = {
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

// Export entitlement comes from the same registry as pricing, including legacy maintenance.
export const QUOTA_LIMITS = Object.fromEntries(Object.entries(registry.tiers).map(([name, tier]) => [
    name.toUpperCase(), { ...(LEGACY_LIMITS[name.toUpperCase()] ?? LEGACY_LIMITS.PRO), EXPORTS: tier.quotas.report_exports_per_month }
])) as Record<PlanType, Record<QuotaType, number>>;

/**
 * 配额重置周期
 */
export const QUOTA_RESET_PERIOD: Record<QuotaType, 'DAILY' | 'MONTHLY' | 'TOTAL'> = {
    AI_CALLS: 'DAILY',
    CALCULATIONS: 'DAILY',
    DIAGNOSES: 'DAILY',
    EXPORTS: 'MONTHLY',
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
    available?: boolean;
}

type Db = Prisma.TransactionClient;
function validate(quotaType: QuotaType, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(QUOTA_RESET_PERIOD, quotaType) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) throw new Error('额度请求参数无效');
}
export function quotaPeriod(quotaType: QuotaType, now = new Date()) {
    const period = QUOTA_RESET_PERIOD[quotaType];
    if (period === 'DAILY') return { start: startOfShanghaiDay(now), end: nextShanghaiMidnight(now) };
    if (period === 'MONTHLY') {
        const shifted = new Date(now.getTime() + 8 * 3600000);
        const year = shifted.getUTCFullYear(), month = shifted.getUTCMonth();
        return { start: new Date(Date.UTC(year, month, 1) - 8 * 3600000), end: new Date(Date.UTC(year, month + 1, 1) - 8 * 3600000) };
    }
    return { start: new Date(0), end: undefined };
}
async function userPlan(db: Db, userId: string, now: Date): Promise<PlanType> {
    const user = await db.user.findUnique({where:{id:userId},select:{plan:true,planExpireAt:true,deletedAt:true}});
    if (!user || user.deletedAt) throw new Error('账户不可用');
    const plan = effectivePlan(user.plan,user.planExpireAt,now) as PlanType;
    if (!Object.prototype.hasOwnProperty.call(QUOTA_LIMITS,plan)) throw new Error('会员档位无效');
    return plan;
}
export async function getUserPlan(userId: string): Promise<PlanType> { return userPlan(prisma,userId,new Date()); }
function usageResult(type: QuotaType, used: number, limit: number, end?: Date): QuotaUsage {
    return {type,used,limit,remaining:limit === -1 ? -1 : Math.max(0,limit-used),percentage:limit === -1 ? 0 : limit === 0 ? 100 : Math.min(100,Math.round(used/limit*100)),resetsAt:end?.toISOString(),exceeded:limit !== -1 && used >= limit};
}
async function readUsage(db: Db, userId: string, type: QuotaType, now: Date) {
    const plan = await userPlan(db,userId,now), limit = QUOTA_LIMITS[plan][type];
    const {start,end} = quotaPeriod(type,now);
    // Sum old daily rows within the month too; changing reset policy must not erase usage.
    const total = await db.quotaUsage.aggregate({where:{userId,type,periodStart:{gte:start,...(end ? {lt:end} : {})}},_sum:{count:true}});
    return usageResult(type,total._sum.count ?? 0,limit,end);
}
export async function getQuotaUsage(userId: string, quotaType: QuotaType): Promise<QuotaUsage> {
    validate(quotaType);return readUsage(prisma,userId,quotaType,new Date());
}
export async function checkQuota(userId: string, quotaType: QuotaType, amount = 1): Promise<{allowed:boolean;usage:QuotaUsage}> {
    validate(quotaType,amount);const usage = await getQuotaUsage(userId,quotaType);
    return {allowed:usage.limit === -1 || usage.remaining >= amount,usage};
}
export async function consumeQuota(userId: string, quotaType: QuotaType, amount = 1): Promise<{success:boolean;usage:QuotaUsage}> {
    validate(quotaType,amount);
    try {
        return await prisma.$transaction(async tx => {
            // Transaction-scoped PostgreSQL lock serializes all writers through this service.
            // A hash collision only serializes unrelated requests; it cannot grant extra quota.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([userId,quotaType])}, 0))`;
            const now = new Date(), usage = await readUsage(tx,userId,quotaType,now);
            if (usage.limit !== -1 && usage.remaining < amount) return {success:false,usage:{...usage,exceeded:true}};
            const {start} = quotaPeriod(quotaType,now);
            await tx.quotaUsage.upsert({where:{userId_type_periodStart:{userId,type:quotaType,periodStart:start}},update:{count:{increment:amount}},create:{userId,type:quotaType,periodStart:start,count:amount}});
            return {success:true,usage:usageResult(quotaType,usage.used+amount,usage.limit,usage.resetsAt ? new Date(usage.resetsAt) : undefined)};
        }, {maxWait:10000,timeout:10000});
    } catch {
        // Do not fabricate zero usage or report exhaustion when the database is unavailable.
        return {success:false,usage:{type:quotaType,used:0,limit:0,remaining:0,percentage:0,exceeded:false,available:false}};
    }
}
export async function getAllQuotaUsage(userId: string): Promise<QuotaUsage[]> {
    return Promise.all((['AI_CALLS','CALCULATIONS','DIAGNOSES','EXPORTS','PAPER_SEARCHES','PAPER_SUMMARIES','PROJECTS','API_CALLS'] as QuotaType[]).map(type=>getQuotaUsage(userId,type)));
}
export function createQuotaMiddleware(quotaType: QuotaType) {
    return async (userId: string, next: () => Promise<void>): Promise<{success:boolean;error?:string;usage?:QuotaUsage}> => {
        const result = await consumeQuota(userId,quotaType);
        if (!result.success) return {success:false,error:result.usage.exceeded ? '操作额度已用尽，请查看套餐或等待重置' : '额度暂时无法核验，请稍后重试',usage:result.usage};
        await next();return {success:true,usage:result.usage};
    };
}
