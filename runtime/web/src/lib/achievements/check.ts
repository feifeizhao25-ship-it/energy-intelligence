// 成就检查与解锁逻辑

import {
    Achievement,
    AchievementCategory,
    allAchievements,
    generationAchievements,
    carbonAchievements,
    usageAchievements,
    communityAchievements,
} from './achievements';
import { emissionFactorNoteFor, resolveEmissionFactor } from '@/lib/standards/emission-factor';

export interface CarbonReduction {
    tonnes: number;
    factorKgPerKwh: number;
    scope: string;
    province: string | null;
    label: string;
}

/** 吨 CO2 = kWh × 因子(kg/kWh) / 1000。已知省份用表 3，否则用全国平均。 */
export function carbonReduction(totalGenerationKwh: number, province?: string | null): CarbonReduction {
    const factor = resolveEmissionFactor(province);
    return {
        tonnes: totalGenerationKwh * factor.value / 1000,
        factorKgPerKwh: factor.value,
        scope: factor.scope,
        province: factor.province,
        label: emissionFactorNoteFor(province),
    };
}

export interface UserStats {
    totalGeneration: number;      // 累计发电量 kWh
    province?: string | null;     // 已知时用省级排放因子
    stationCount: number;         // 电站数量
    recordStreak: number;         // 连续记录天数
    totalRecords: number;         // 总记录次数
    aiChatCount: number;          // AI对话次数
    questionCount: number;        // 提问次数
    answerCount: number;          // 回答次数
    totalLikes: number;           // 获赞次数
    referralCount: number;        // 邀请人数
    calcCount: number;            // 测算次数
}

export interface UnlockedAchievement {
    achievementId: string;
    unlockedAt: Date;
    isNew?: boolean;  // 是否刚刚解锁
}

/**
 * 检查用户获得的所有成就
 */
export function checkAllAchievements(
    stats: UserStats,
    existingAchievements: string[] = []
): UnlockedAchievement[] {
    const unlocked: UnlockedAchievement[] = [];
    const now = new Date();

    // 检查发电成就
    for (const achievement of generationAchievements) {
        if (achievement.threshold && stats.totalGeneration >= achievement.threshold) {
            if (!existingAchievements.includes(achievement.id)) {
                unlocked.push({ achievementId: achievement.id, unlockedAt: now, isNew: true });
            }
        }
    }

    const co2Reduced = carbonReduction(stats.totalGeneration, stats.province).tonnes;
    for (const achievement of carbonAchievements) {
        if (achievement.threshold && co2Reduced >= achievement.threshold) {
            if (!existingAchievements.includes(achievement.id)) {
                unlocked.push({ achievementId: achievement.id, unlockedAt: now, isNew: true });
            }
        }
    }

    // 检查使用成就
    for (const achievement of usageAchievements) {
        let qualified = false;

        switch (achievement.id) {
            case 'first_calc':
                qualified = stats.calcCount >= 1;
                break;
            case 'first_station':
                qualified = stats.stationCount >= 1;
                break;
            case 'first_record':
                qualified = stats.totalRecords >= 1;
                break;
            case 'streak_7':
                qualified = stats.recordStreak >= 7;
                break;
            case 'streak_30':
                qualified = stats.recordStreak >= 30;
                break;
            case 'streak_100':
                qualified = stats.recordStreak >= 100;
                break;
            case 'multi_station':
                qualified = stats.stationCount >= 5;
                break;
            case 'ai_master':
                qualified = stats.aiChatCount >= 100;
                break;
        }

        if (qualified && !existingAchievements.includes(achievement.id)) {
            unlocked.push({ achievementId: achievement.id, unlockedAt: now, isNew: true });
        }
    }

    // 检查社区成就
    for (const achievement of communityAchievements) {
        let qualified = false;

        switch (achievement.id) {
            case 'first_question':
                qualified = stats.questionCount >= 1;
                break;
            case 'first_answer':
                qualified = stats.answerCount >= 1;
                break;
            case 'answers_10':
                qualified = stats.answerCount >= 10;
                break;
            case 'likes_50':
                qualified = stats.totalLikes >= 50;
                break;
            case 'likes_100':
                qualified = stats.totalLikes >= 100;
                break;
            case 'referral_5':
                qualified = stats.referralCount >= 5;
                break;
            case 'referral_10':
                qualified = stats.referralCount >= 10;
                break;
        }

        if (qualified && !existingAchievements.includes(achievement.id)) {
            unlocked.push({ achievementId: achievement.id, unlockedAt: now, isNew: true });
        }
    }

    return unlocked;
}

/**
 * 计算成就进度
 */
export function getAchievementProgress(
    achievement: Achievement,
    stats: UserStats
): { current: number; target: number; percentage: number } {
    let current = 0;
    const target = achievement.threshold || 1;

    switch (achievement.category) {
        case AchievementCategory.GENERATION:
            current = stats.totalGeneration;
            break;
        case AchievementCategory.CARBON:
            current = carbonReduction(stats.totalGeneration, stats.province).tonnes;
            break;
        case AchievementCategory.USAGE:
            switch (achievement.id) {
                case 'first_calc': current = stats.calcCount; break;
                case 'first_station': current = stats.stationCount; break;
                case 'first_record': current = stats.totalRecords; break;
                case 'streak_7':
                case 'streak_30':
                case 'streak_100':
                    current = stats.recordStreak;
                    break;
                case 'multi_station': current = stats.stationCount; break;
                case 'ai_master': current = stats.aiChatCount; break;
            }
            break;
        case AchievementCategory.COMMUNITY:
            switch (achievement.id) {
                case 'first_question': current = stats.questionCount; break;
                case 'first_answer': current = stats.answerCount; break;
                case 'answers_10': current = stats.answerCount; break;
                case 'likes_50':
                case 'likes_100':
                    current = stats.totalLikes;
                    break;
                case 'referral_5':
                case 'referral_10':
                    current = stats.referralCount;
                    break;
            }
            break;
    }

    const percentage = Math.min(100, Math.round((current / target) * 100));
    return { current, target, percentage };
}

/**
 * 获取下一个即将解锁的成就
 */
export function getNextAchievements(
    stats: UserStats,
    existingAchievements: string[],
    limit: number = 3
): { achievement: Achievement; progress: number }[] {
    const upcoming: { achievement: Achievement; progress: number }[] = [];

    for (const achievement of allAchievements) {
        if (existingAchievements.includes(achievement.id)) continue;
        if (achievement.secret) continue;

        const { percentage } = getAchievementProgress(achievement, stats);
        if (percentage > 0 && percentage < 100) {
            upcoming.push({ achievement, progress: percentage });
        }
    }

    // 按进度排序，返回最接近完成的
    return upcoming
        .sort((a, b) => b.progress - a.progress)
        .slice(0, limit);
}

/**
 * 格式化成就进度文本
 */
export function formatProgressText(
    achievement: Achievement,
    stats: UserStats
): string {
    const { current, target } = getAchievementProgress(achievement, stats);

    switch (achievement.category) {
        case AchievementCategory.GENERATION:
            return `${current.toLocaleString()} / ${target.toLocaleString()} 度`;
        case AchievementCategory.CARBON: {
            const reduction = carbonReduction(stats.totalGeneration, stats.province);
            return `${current.toFixed(1)} / ${target} 吨（${reduction.label}）`;
        }
        default:
            return `${current} / ${target}`;
    }
}
