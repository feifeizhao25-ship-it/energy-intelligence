// 会员计划配置和权限定义

export enum Plan {
    FREE = 'FREE',
    PRO = 'PRO',
    MAINTENANCE = 'MAINTENANCE',
    FULL = 'FULL',
    TEAM = 'TEAM',
    ENTERPRISE = 'ENTERPRISE',
}

// 会员计划详情
export const PLAN_DETAILS = {
    FREE: {
        name: '免费版',
        price: 0,
        monthlyPrice: 0,
        yearlyPrice: 0,
        icon: '🆓',
        description: '基础体验，建立认知',
        color: 'gray',
    },
    PRO: {
        name: '专业版',
        price: 1980,
        monthlyPrice: 198,
        yearlyPrice: 1980,
        icon: '⭐',
        description: '资源查询+收益计算+文献检索',
        color: 'blue',
        popular: true,
    },
    MAINTENANCE: {
        name: '运维版',
        price: 2980,
        monthlyPrice: 298,
        yearlyPrice: 2980,
        icon: '🔧',
        description: '专业运维诊断+检修管理',
        color: 'green',
    },
    FULL: {
        name: '全能版',
        price: 3980,
        monthlyPrice: 398,
        yearlyPrice: 3980,
        icon: '💎',
        description: '全部功能无限制',
        color: 'purple',
        recommended: true,
    },
    TEAM: {
        name: '团队版',
        price: 9800,
        monthlyPrice: 0,
        yearlyPrice: 9800,
        icon: '👥',
        description: '5账号+协作功能',
        color: 'orange',
    },
    ENTERPRISE: {
        name: '企业版',
        price: 38000,
        monthlyPrice: 0,
        yearlyPrice: 38000,
        icon: '🏢',
        description: '无限账号+API+定制',
        color: 'red',
    },
} as const;

// 每日使用限额配置
export const USAGE_LIMITS = {
    FREE: {
        ai_chat: 3,           // 降低至3次/天
        resource_query: 2,    // 降低至2次
        calculation: 2,       // 降低至2次
        paper_search: 3,      // 降低至3次
        diagnosis: 0,         // 免费用户无诊断权限
        saved_papers: 5,      // 降低至5篇
        saved_locations: 2,   // 降低至2个
        projects: 1,          // 降低至1个
        stations: 0,
        folders: 1,
    },
    PRO: {
        ai_chat: 100,
        resource_query: Infinity,
        calculation: Infinity,
        paper_search: Infinity,
        diagnosis: 3,
        saved_papers: 500,
        saved_locations: 50,
        projects: 50,
        stations: 0,
        folders: 20,
    },
    MAINTENANCE: {
        ai_chat: 100,
        resource_query: Infinity,
        calculation: 10,
        paper_search: 10,
        diagnosis: Infinity,
        saved_papers: 50,
        saved_locations: 20,
        projects: 10,
        stations: 10,
        folders: 5,
    },
    FULL: {
        ai_chat: 300,
        resource_query: Infinity,
        calculation: Infinity,
        paper_search: Infinity,
        diagnosis: Infinity,
        saved_papers: 2000,
        saved_locations: 200,
        projects: 200,
        stations: 50,
        folders: 50,
    },
    TEAM: {
        ai_chat: 500, // 共享
        resource_query: Infinity,
        calculation: Infinity,
        paper_search: Infinity,
        diagnosis: Infinity,
        saved_papers: 5000,
        saved_locations: 500,
        projects: 500,
        stations: 100,
        folders: 100,
    },
    ENTERPRISE: {
        ai_chat: Infinity,
        resource_query: Infinity,
        calculation: Infinity,
        paper_search: Infinity,
        diagnosis: Infinity,
        saved_papers: Infinity,
        saved_locations: Infinity,
        projects: Infinity,
        stations: Infinity,
        folders: Infinity,
    },
} as const;

// 功能访问权限
export const FEATURE_ACCESS = {
    // 资源地图
    monthly_data: ['PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    historical_trend: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    multi_compare: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    solar_trajectory: ['PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    heatmap_layer: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],

    // 收益计算
    wind_calculation: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    pv_wind_compare: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    sensitivity_analysis: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    cash_flow_25y: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    village_enterprise_mode: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],

    // 运维诊断
    pr_deep_analysis: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    cleaning_decision: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    inverter_diagnosis: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    string_analysis: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    iv_curve_analysis: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    work_permit: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    predictive_maintenance: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    downtime_loss: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    wind_fault_diagnosis: ['MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],

    // 文献检索
    ai_summary: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    citation_network: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    similar_papers: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    citation_format: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    reading_notes: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    batch_export: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],
    author_tracking: ['PRO', 'FULL', 'TEAM', 'ENTERPRISE'],

    // AI助手
    multi_turn_task: ['PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    report_generation: ['PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    priority_response: ['FULL', 'TEAM', 'ENTERPRISE'],

    // 报告导出
    report_export: ['PRO', 'MAINTENANCE', 'FULL', 'TEAM', 'ENTERPRISE'],
    no_watermark: ['FULL', 'TEAM', 'ENTERPRISE'],
    white_label: ['ENTERPRISE'],
    batch_export_report: ['FULL', 'TEAM', 'ENTERPRISE'],

    // 团队/企业专属
    api_access: ['ENTERPRISE'],
    sso_login: ['ENTERPRISE'],
    custom_development: ['ENTERPRISE'],
} as const;

// 多点对比数量限制
export const MULTI_COMPARE_LIMITS = {
    FREE: 0,
    PRO: 3,
    MAINTENANCE: 0,
    FULL: 10,
    TEAM: 10,
    ENTERPRISE: Infinity,
} as const;

// 报告导出格式权限
export const EXPORT_FORMATS = {
    FREE: [],
    PRO: ['PDF', 'Word'],
    MAINTENANCE: ['PDF'],
    FULL: ['PDF', 'Word', 'Excel'],
    TEAM: ['PDF', 'Word', 'Excel'],
    ENTERPRISE: ['PDF', 'Word', 'Excel', 'White_Label'],
} as const;

// 历史数据保留时间（天）
export const DATA_RETENTION = {
    FREE: 7,
    PRO: 365,
    MAINTENANCE: 365,
    FULL: Infinity,
    TEAM: Infinity,
    ENTERPRISE: Infinity,
} as const;

// AI模型访问权限配置
export const AI_MODEL_TIERS = {
    FREE: {
        defaultModel: 'glm-4-flash',         // 快速但能力弱
        allowedModels: ['glm-4-flash'],
        maxTokens: 1024,
    },
    PRO: {
        defaultModel: 'glm-4-plus',
        allowedModels: ['glm-4-flash', 'glm-4-plus', 'deepseek-chat'],
        maxTokens: 4096,
    },
    MAINTENANCE: {
        defaultModel: 'glm-4-plus',
        allowedModels: ['glm-4-flash', 'glm-4-plus', 'deepseek-chat'],
        maxTokens: 4096,
    },
    FULL: {
        defaultModel: 'deepseek-v3',
        allowedModels: ['glm-4-flash', 'glm-4-plus', 'deepseek-chat', 'deepseek-v3', 'moonshot-v1-auto'],
        maxTokens: 8192,
    },
    TEAM: {
        defaultModel: 'deepseek-v3',
        allowedModels: ['glm-4-flash', 'glm-4-plus', 'deepseek-chat', 'deepseek-v3', 'moonshot-v1-auto'],
        maxTokens: 8192,
    },
    ENTERPRISE: {
        defaultModel: 'deepseek-v3',
        allowedModels: ['glm-4-flash', 'glm-4-plus', 'deepseek-chat', 'deepseek-v3', 'moonshot-v1-auto', 'claude-sonnet'],
        maxTokens: 16384,
    },
} as const;

// 年付优惠配置 (10个月=1年)
export const ANNUAL_DISCOUNT = {
    monthsEquivalent: 10,  // 年付相当于10个月价格
    discountLabel: '省2个月',
    badgeText: '年付优惠',
} as const;

// 获取年付价格
export function getAnnualPrice(plan: Plan): number {
    const details = PLAN_DETAILS[plan];
    if (!details || !details.monthlyPrice) return 0;
    return details.monthlyPrice * ANNUAL_DISCOUNT.monthsEquivalent;
}

// 获取用户可用的AI模型
export function getAvailableModels(plan: Plan): string[] {
    return [...(AI_MODEL_TIERS[plan]?.allowedModels || AI_MODEL_TIERS.FREE.allowedModels)];
}

// 获取用户默认AI模型
export function getDefaultModel(plan: Plan): string {
    return AI_MODEL_TIERS[plan]?.defaultModel || AI_MODEL_TIERS.FREE.defaultModel;
}
