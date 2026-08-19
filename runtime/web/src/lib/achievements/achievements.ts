// 成就系统定义

export enum AchievementCategory {
    GENERATION = 'generation',    // 发电成就
    CARBON = 'carbon',           // 环保成就
    USAGE = 'usage',             // 使用成就
    COMMUNITY = 'community',     // 社区成就
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    threshold?: number;
    reward?: {
        type: 'pro_days' | 'badge' | 'discount';
        value: number;
    };
    secret?: boolean;  // 隐藏成就
}

// 发电成就
export const generationAchievements: Achievement[] = [
    {
        id: 'gen_1k',
        name: '新手上路',
        description: '累计发电突破 1,000 度',
        icon: '🌱',
        category: AchievementCategory.GENERATION,
        threshold: 1000,
        reward: { type: 'badge', value: 1 },
    },
    {
        id: 'gen_10k',
        name: '小有成就',
        description: '累计发电突破 10,000 度',
        icon: '⚡',
        category: AchievementCategory.GENERATION,
        threshold: 10000,
        reward: { type: 'pro_days', value: 3 },
    },
    {
        id: 'gen_50k',
        name: '发电能手',
        description: '累计发电突破 50,000 度',
        icon: '💡',
        category: AchievementCategory.GENERATION,
        threshold: 50000,
        reward: { type: 'pro_days', value: 5 },
    },
    {
        id: 'gen_100k',
        name: '发电达人',
        description: '累计发电突破 100,000 度',
        icon: '🏆',
        category: AchievementCategory.GENERATION,
        threshold: 100000,
        reward: { type: 'pro_days', value: 7 },
    },
    {
        id: 'gen_500k',
        name: '发电专家',
        description: '累计发电突破 500,000 度',
        icon: '🌟',
        category: AchievementCategory.GENERATION,
        threshold: 500000,
        reward: { type: 'discount', value: 10 },
    },
    {
        id: 'gen_1m',
        name: '发电大师',
        description: '累计发电突破 1,000,000 度',
        icon: '💎',
        category: AchievementCategory.GENERATION,
        threshold: 1000000,
        reward: { type: 'discount', value: 20 },
    },
];

// 环保成就
export const carbonAchievements: Achievement[] = [
    {
        id: 'carbon_1t',
        name: '环保新人',
        description: '累计减排 CO₂ 1 吨',
        icon: '🌱',
        category: AchievementCategory.CARBON,
        threshold: 1,
    },
    {
        id: 'carbon_5t',
        name: '绿色使者',
        description: '累计减排 CO₂ 5 吨',
        icon: '🌿',
        category: AchievementCategory.CARBON,
        threshold: 5,
        reward: { type: 'pro_days', value: 2 },
    },
    {
        id: 'carbon_10t',
        name: '绿色卫士',
        description: '累计减排 CO₂ 10 吨',
        icon: '🌳',
        category: AchievementCategory.CARBON,
        threshold: 10,
        reward: { type: 'pro_days', value: 5 },
    },
    {
        id: 'carbon_50t',
        name: '环保先锋',
        description: '累计减排 CO₂ 50 吨',
        icon: '🏔️',
        category: AchievementCategory.CARBON,
        threshold: 50,
        reward: { type: 'pro_days', value: 7 },
    },
    {
        id: 'carbon_100t',
        name: '地球守护者',
        description: '累计减排 CO₂ 100 吨',
        icon: '🌍',
        category: AchievementCategory.CARBON,
        threshold: 100,
        reward: { type: 'discount', value: 15 },
    },
];

// 使用成就
export const usageAchievements: Achievement[] = [
    {
        id: 'first_calc',
        name: '初次体验',
        description: '完成第一次收益测算',
        icon: '⭐',
        category: AchievementCategory.USAGE,
    },
    {
        id: 'first_station',
        name: '电站主人',
        description: '添加第一个电站',
        icon: '🏠',
        category: AchievementCategory.USAGE,
    },
    {
        id: 'first_record',
        name: '数据记录者',
        description: '第一次录入发电数据',
        icon: '📊',
        category: AchievementCategory.USAGE,
    },
    {
        id: 'streak_7',
        name: '坚持一周',
        description: '连续7天记录发电数据',
        icon: '🔥',
        category: AchievementCategory.USAGE,
        threshold: 7,
        reward: { type: 'pro_days', value: 1 },
    },
    {
        id: 'streak_30',
        name: '月度达人',
        description: '连续30天记录发电数据',
        icon: '👑',
        category: AchievementCategory.USAGE,
        threshold: 30,
        reward: { type: 'pro_days', value: 7 },
    },
    {
        id: 'streak_100',
        name: '百日坚持',
        description: '连续100天记录发电数据',
        icon: '💯',
        category: AchievementCategory.USAGE,
        threshold: 100,
        reward: { type: 'discount', value: 10 },
    },
    {
        id: 'multi_station',
        name: '电站帝国',
        description: '拥有5个以上电站',
        icon: '🏭',
        category: AchievementCategory.USAGE,
        threshold: 5,
        secret: true,
    },
    {
        id: 'ai_master',
        name: 'AI 大师',
        description: '与AI对话超过100次',
        icon: '🤖',
        category: AchievementCategory.USAGE,
        threshold: 100,
        secret: true,
    },
];

// 社区成就
export const communityAchievements: Achievement[] = [
    {
        id: 'first_question',
        name: '好奇宝宝',
        description: '第一次提问',
        icon: '❓',
        category: AchievementCategory.COMMUNITY,
    },
    {
        id: 'first_answer',
        name: '热心解答',
        description: '第一次回答问题',
        icon: '💬',
        category: AchievementCategory.COMMUNITY,
    },
    {
        id: 'answers_10',
        name: '乐于助人',
        description: '回答10个问题',
        icon: '🙋',
        category: AchievementCategory.COMMUNITY,
        threshold: 10,
        reward: { type: 'pro_days', value: 3 },
    },
    {
        id: 'likes_50',
        name: '人气新星',
        description: '获得50个赞',
        icon: '👍',
        category: AchievementCategory.COMMUNITY,
        threshold: 50,
        reward: { type: 'pro_days', value: 3 },
    },
    {
        id: 'likes_100',
        name: '社区明星',
        description: '回答获得100个赞',
        icon: '🌟',
        category: AchievementCategory.COMMUNITY,
        threshold: 100,
        reward: { type: 'pro_days', value: 7 },
    },
    {
        id: 'referral_5',
        name: '推广达人',
        description: '成功邀请5位好友',
        icon: '🎁',
        category: AchievementCategory.COMMUNITY,
        threshold: 5,
        reward: { type: 'pro_days', value: 14 },
    },
    {
        id: 'referral_10',
        name: '推广大使',
        description: '成功邀请10位好友',
        icon: '👑',
        category: AchievementCategory.COMMUNITY,
        threshold: 10,
        reward: { type: 'discount', value: 20 },
    },
];

// 全部成就
export const allAchievements: Achievement[] = [
    ...generationAchievements,
    ...carbonAchievements,
    ...usageAchievements,
    ...communityAchievements,
];

// 获取成就详情
export function getAchievementById(id: string): Achievement | undefined {
    return allAchievements.find(a => a.id === id);
}

// 获取分类成就
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return allAchievements.filter(a => a.category === category);
}

// 成就分类配置
export const categoryConfig = {
    [AchievementCategory.GENERATION]: {
        name: '发电成就',
        description: '记录你的发电里程碑',
        icon: '⚡',
        color: 'text-amber-500',
        bgColor: 'bg-amber-50',
    },
    [AchievementCategory.CARBON]: {
        name: '环保成就',
        description: '你为地球做出的贡献',
        icon: '🌍',
        color: 'text-green-500',
        bgColor: 'bg-green-50',
    },
    [AchievementCategory.USAGE]: {
        name: '使用成就',
        description: '坚持记录，见证成长',
        icon: '📈',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
    },
    [AchievementCategory.COMMUNITY]: {
        name: '社区成就',
        description: '分享知识，帮助他人',
        icon: '💬',
        color: 'text-purple-500',
        bgColor: 'bg-purple-50',
    },
};
