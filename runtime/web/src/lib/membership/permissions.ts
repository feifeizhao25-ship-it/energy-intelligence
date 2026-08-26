// 会员权限检查和使用限额管理

import { Plan, USAGE_LIMITS, FEATURE_ACCESS, MULTI_COMPARE_LIMITS } from './plans';

export interface UsageCheckResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt?: Date;
    message?: string;
}

export interface User {
    id: string;
    plan: Plan;
    planExpireAt?: Date;
    dailyAiCalls: number;
    dailyResourceQueries: number;
    dailyCalculations: number;
    dailyPaperSearches: number;
    dailyDiagnoses: number;
    projectCount: number;
    paperCount: number;
    stationCount: number;
    folderCount: number;
    lastResetAt: Date;
}

/**
 * 检查用户会员是否有效
 */
export function isPlanActive(user: User): boolean {
    if (user.plan === 'FREE') return true;
    if (!user.planExpireAt) return false;
    return new Date(user.planExpireAt) > new Date();
}

/**
 * 获取用户的有效会员等级（如果过期则降级为免费版）
 */
export function getEffectivePlan(user: User): Plan {
    return isPlanActive(user) ? user.plan : Plan.FREE;
}

/**
 * 检查功能访问权限
 */
export function checkFeatureAccess(user: User, feature: keyof typeof FEATURE_ACCESS): {
    allowed: boolean;
    message?: string;
    requiredPlans?: Plan[];
} {
    const effectivePlan = getEffectivePlan(user);
    const allowedPlans = FEATURE_ACCESS[feature];

    if (!allowedPlans) {
        return { allowed: true }; // 未定义的功能默认开放
    }

    const allowed = (allowedPlans as readonly string[]).includes(effectivePlan);

    return {
        allowed,
        message: allowed ? undefined : '此功能需要升级会员',
        requiredPlans: allowed ? undefined : [...allowedPlans] as Plan[],
    };
}

/**
 * 检查每日使用限额
 */
export function checkUsageLimit(
    user: User,
    feature: keyof typeof USAGE_LIMITS['FREE']
): UsageCheckResult {
    const effectivePlan = getEffectivePlan(user);
    const limits = USAGE_LIMITS[effectivePlan];
    const limit = limits[feature] ?? 0;

    // 获取当前使用量
    let currentUsage = 0;
    switch (feature) {
        case 'ai_chat':
            currentUsage = user.dailyAiCalls;
            break;
        case 'resource_query':
            currentUsage = user.dailyResourceQueries;
            break;
        case 'calculation':
            currentUsage = user.dailyCalculations;
            break;
        case 'paper_search':
            currentUsage = user.dailyPaperSearches;
            break;
        case 'diagnosis':
            currentUsage = user.dailyDiagnoses;
            break;
        case 'saved_papers':
            currentUsage = user.paperCount;
            break;
        case 'projects':
            currentUsage = user.projectCount;
            break;
        case 'stations':
            currentUsage = user.stationCount;
            break;
        case 'folders':
            currentUsage = user.folderCount;
            break;
    }

    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - currentUsage);
    const allowed = limit === Infinity || currentUsage < limit;

    // 计算重置时间（次日0点）
    const resetAt = new Date();
    resetAt.setDate(resetAt.getDate() + 1);
    resetAt.setHours(0, 0, 0, 0);

    return {
        allowed,
        limit: limit === Infinity ? -1 : limit,
        remaining: remaining === Infinity ? -1 : remaining,
        resetAt,
        message: allowed ? undefined : `今日${getFeatureName(feature)}次数已用完，请升级会员或等待明日重置`,
    };
}

/**
 * 检查存储空间限额
 */
export function checkStorageLimit(
    user: User,
    type: 'projects' | 'saved_papers' | 'stations' | 'folders'
): UsageCheckResult {
    return checkUsageLimit(user, type);
}

/**
 * 检查多点对比限制
 */
export function checkMultiCompareLimit(user: User, requestedPoints: number): UsageCheckResult {
    const effectivePlan = getEffectivePlan(user);
    const limit = MULTI_COMPARE_LIMITS[effectivePlan];

    const allowed = limit === Infinity || requestedPoints <= limit;

    return {
        allowed,
        limit: limit === Infinity ? -1 : limit,
        remaining: limit === Infinity ? -1 : Math.max(0, limit - requestedPoints),
        message: allowed ? undefined : `多点对比最多支持${limit}个点，请升级会员`,
    };
}

/**
 * 检查是否需要重置每日使用量
 */
export function shouldResetDailyUsage(user: User): boolean {
    const lastReset = new Date(user.lastResetAt);
    const now = new Date();

    // 判断是否跨天
    return (
        lastReset.getDate() !== now.getDate() ||
        lastReset.getMonth() !== now.getMonth() ||
        lastReset.getFullYear() !== now.getFullYear()
    );
}

/**
 * 获取会员升级建议
 */
export function getUpgradeSuggestion(user: User, blockedFeature: string): {
    message: string;
    suggestedPlans: Array<{ plan: Plan; reason: string }>;
} {
    const currentPlan = getEffectivePlan(user);

    const suggestions: Array<{ plan: Plan; reason: string }> = [];

    // 根据被阻止的功能推荐会员
    if (blockedFeature.includes('维护') || blockedFeature.includes('诊断')) {
        if (currentPlan === 'FREE' || currentPlan === 'PRO') {
            suggestions.push({
                plan: Plan.MAINTENANCE,
                reason: '解锁全部运维诊断功能',
            });
            suggestions.push({
                plan: Plan.FULL,
                reason: '包含运维功能+专业版全部功能',
            });
        }
    } else if (blockedFeature.includes('资源') || blockedFeature.includes('计算')) {
        if (currentPlan === 'FREE') {
            suggestions.push({
                plan: Plan.PRO,
                reason: '无限次资源查询和收益计算',
            });
        }
        if (currentPlan === 'FREE' || currentPlan === 'MAINTENANCE') {
            suggestions.push({
                plan: Plan.FULL,
                reason: '全部功能无限制使用',
            });
        }
    }

    // 默认推荐全能版
    if (suggestions.length === 0) {
        suggestions.push({
            plan: Plan.FULL,
            reason: '全部功能无限制，性价比最高',
        });
    }

    return {
        message: '升级会员即可解锁此功能',
        suggestedPlans: suggestions,
    };
}

/**
 * 获取功能的友好名称
 */
function getFeatureName(feature: string): string {
    const names: Record<string, string> = {
        ai_chat: 'AI对话',
        resource_query: '资源查询',
        calculation: '收益计算',
        paper_search: '文献搜索',
        diagnosis: '运维诊断',
        saved_papers: '文献收藏',
        projects: '项目保存',
        stations: '电站管理',
        folders: '文献夹',
    };

    return names[feature] || feature;
}

/**
 * 格式化会员过期提醒
 */
export function formatExpiryReminder(user: User): string | null {
    if (user.plan === 'FREE' || !user.planExpireAt) {
        return null;
    }

    const expireAt = new Date(user.planExpireAt);
    const now = new Date();
    const daysLeft = Math.ceil((expireAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return '您的会员已过期，请及时续费以继续使用高级功能';
    } else if (daysLeft <= 7) {
        return `您的会员将在${daysLeft}天后过期，续费享8折优惠`;
    } else if (daysLeft <= 30) {
        return `您的会员还有${daysLeft}天到期`;
    }

    return null;
}
