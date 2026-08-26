// 邀请裂变系统

import { nanoid } from 'nanoid';

// 邀请奖励配置
export const REFERRAL_REWARDS = {
    inviter: {
        proDays: 7,           // 邀请人获得专业版天数
        cashback: 10,         // 现金返现（元），被邀请人付费后
        maxCashback: 500,     // 最大返现金额
    },
    invitee: {
        proDays: 3,           // 被邀请人获得专业版天数
        discount: 10,         // 首次付费折扣（%）
    },
};

// 邀请等级
export const REFERRAL_LEVELS = [
    { level: 1, name: '推广新人', threshold: 0, bonus: 0 },
    { level: 2, name: '推广达人', threshold: 5, bonus: 1 },    // +1天/人
    { level: 3, name: '推广大师', threshold: 20, bonus: 2 },   // +2天/人
    { level: 4, name: '推广大使', threshold: 50, bonus: 3 },   // +3天/人
];

export interface ReferralCode {
    code: string;
    userId: string;
    createdAt: Date;
    usedCount: number;
    totalRewards: number;  // 累计获得奖励（天）
}

export interface ReferralRecord {
    id: string;
    inviterId: string;
    inviteeId: string;
    inviteePhone: string;
    status: 'registered' | 'paid';
    reward: {
        proDays: number;
        cash?: number;
    };
    createdAt: Date;
    paidAt?: Date;
}

// 生成邀请码
export function generateReferralCode(userId: string): string {
    // 格式: 前缀 + 用户ID哈希 + 随机码
    const userHash = hashUserId(userId).slice(0, 4).toUpperCase();
    const randomPart = nanoid(4).toUpperCase();
    return `NY${userHash}${randomPart}`;
}

// 简单哈希函数
function hashUserId(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

// 验证邀请码
export function isValidReferralCode(code: string): boolean {
    // 格式检查: NY + 8位字母数字
    return /^NY[A-Z0-9]{8}$/.test(code);
}

// 计算邀请人等级
export function getReferralLevel(inviteCount: number): typeof REFERRAL_LEVELS[0] {
    let level = REFERRAL_LEVELS[0];
    for (const l of REFERRAL_LEVELS) {
        if (inviteCount >= l.threshold) {
            level = l;
        }
    }
    return level;
}

// 计算邀请奖励
export function calculateReward(
    inviteCount: number,
    isPaid: boolean = false
): { proDays: number; cash?: number } {
    const level = getReferralLevel(inviteCount);
    const baseDays = REFERRAL_REWARDS.inviter.proDays;
    const bonusDays = level.bonus;

    const reward: { proDays: number; cash?: number } = {
        proDays: baseDays + bonusDays,
    };

    if (isPaid) {
        reward.cash = REFERRAL_REWARDS.inviter.cashback;
    }

    return reward;
}

// 生成邀请链接
export function generateShareUrl(code: string, baseUrl: string = 'https://energy.ai'): string {
    return `${baseUrl}/invite/${code}`;
}

// 生成分享文案
export function generateShareText(userName: string, code: string): {
    title: string;
    description: string;
    hashtags: string[];
} {
    return {
        title: `${userName}邀请你体验新能源智库`,
        description: `免费测算屋顶光伏能帮你赚多少钱！新用户注册即送3天专业版体验，使用邀请码 ${code} 还有额外福利~`,
        hashtags: ['新能源', '光伏发电', '清洁能源', '投资理财'],
    };
}

// 社交分享配置
export const SHARE_PLATFORMS = [
    {
        id: 'wechat',
        name: '微信',
        icon: '💬',
        available: true,
    },
    {
        id: 'wechat_moments',
        name: '朋友圈',
        icon: '⭕',
        available: true,
    },
    {
        id: 'weibo',
        name: '微博',
        icon: '📮',
        available: true,
    },
    {
        id: 'qq',
        name: 'QQ',
        icon: '🐧',
        available: true,
    },
    {
        id: 'copy',
        name: '复制链接',
        icon: '🔗',
        available: true,
    },
];

// 邀请统计
export interface ReferralStats {
    totalInvited: number;
    registeredCount: number;
    paidCount: number;
    totalProDays: number;
    totalCashEarned: number;
    level: typeof REFERRAL_LEVELS[0];
    nextLevelProgress: number;  // 0-100
}

export function calculateReferralStats(records: ReferralRecord[]): ReferralStats {
    const totalInvited = records.length;
    const registeredCount = records.filter(r => r.status === 'registered' || r.status === 'paid').length;
    const paidCount = records.filter(r => r.status === 'paid').length;

    const totalProDays = records.reduce((sum, r) => sum + r.reward.proDays, 0);
    const totalCashEarned = records.reduce((sum, r) => sum + (r.reward.cash || 0), 0);

    const level = getReferralLevel(registeredCount);
    const nextLevel = REFERRAL_LEVELS.find(l => l.threshold > registeredCount);
    const nextLevelProgress = nextLevel
        ? Math.round((registeredCount / nextLevel.threshold) * 100)
        : 100;

    return {
        totalInvited,
        registeredCount,
        paidCount,
        totalProDays,
        totalCashEarned,
        level,
        nextLevelProgress,
    };
}
