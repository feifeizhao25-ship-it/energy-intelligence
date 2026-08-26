// 项目生命周期编排器 - ActionCard 模板
// 便于运营调整文案，保持一致性

import type { ActionCard } from '../types';

/**
 * ActionCard 模板工厂
 * 所有推荐动作都从这里生成，方便统一管理
 */
export const ACTION_TEMPLATES = {
    // ============ 资源评估类 ============

    setLocation: (): ActionCard => ({
        id: 'set_location',
        title: '📍 设置项目位置',
        description: '选择项目地址，获取精准资源数据',
        priority: 1,
        category: 'RESOURCE',
        cta: {
            type: 'OPEN_MODAL',
            target: 'location_picker',
        },
        rationale: {
            type: 'RULE',
            summary: '位置是所有分析的基础',
        },
    }),

    getSolarResource: (): ActionCard => ({
        id: 'get_solar_resource',
        title: '☀️ 获取太阳能资源评估',
        description: '基于 NASA 卫星数据，分析年辐照量和最佳倾角',
        priority: 1,
        category: 'RESOURCE',
        cta: {
            type: 'RUN_TOOL',
            target: 'getSolarResource',
        },
        rationale: {
            type: 'RULE',
            summary: '资源评估是收益测算的前提',
            evidence: ['使用 NASA POWER 20年气象数据', '自动计算最佳安装倾角'],
        },
    }),

    getWindResource: (): ActionCard => ({
        id: 'get_wind_resource',
        title: '💨 获取风能资源评估',
        description: '分析不同高度风速和风功率密度',
        priority: 1,
        category: 'RESOURCE',
        cta: {
            type: 'RUN_TOOL',
            target: 'getWindResource',
        },
        rationale: {
            type: 'RULE',
            summary: '评估风电开发潜力',
        },
    }),

    // ============ 收益计算类 ============

    calculateSolar: (): ActionCard => ({
        id: 'calculate_solar',
        title: '💰 光伏收益测算',
        description: '计算 25 年投资回报、IRR 和现金流',
        priority: 1,
        category: 'CALCULATION',
        cta: {
            type: 'NAVIGATE',
            target: '/quick-calc/solar',
        },
        rationale: {
            type: 'RULE',
            summary: '已有资源数据，可进行收益测算',
        },
    }),

    calculateWind: (): ActionCard => ({
        id: 'calculate_wind',
        title: '💰 风电收益测算',
        description: '计算风电项目投资回报',
        priority: 1,
        category: 'CALCULATION',
        cta: {
            type: 'NAVIGATE',
            target: '/quick-calc/wind',
        },
        rationale: {
            type: 'RULE',
            summary: '已有风能资源数据',
        },
    }),

    calculateStorage: (): ActionCard => ({
        id: 'calculate_storage',
        title: '🔋 储能收益测算',
        description: '计算峰谷价差收益',
        priority: 2,
        category: 'CALCULATION',
        cta: {
            type: 'NAVIGATE',
            target: '/quick-calc/storage',
        },
        rationale: {
            type: 'RULE',
            summary: '适合工商业用户削峰填谷',
        },
    }),

    unlockFullAnalysis: (): ActionCard => ({
        id: 'unlock_full_analysis',
        title: '🔓 查看完整分析',
        description: '解锁 IRR、敏感性分析和 25 年现金流',
        priority: 1,
        category: 'CALCULATION',
        cta: {
            type: 'OPEN_MODAL',
            target: 'paywall',
            params: { feature: 'FULL_ANALYSIS' },
        },
        rationale: {
            type: 'RULE',
            summary: '完整报告帮助您做出更准确的投资决策',
        },
        requiresPlan: 'PRO',
    }),

    compareSites: (): ActionCard => ({
        id: 'compare_sites',
        title: '⚖️ 站址比选',
        description: '对比多个位置的收益差异，选出最优方案',
        priority: 2,
        category: 'CALCULATION',
        cta: {
            type: 'NAVIGATE',
            target: '/quick-calc/compare',
        },
        rationale: {
            type: 'RULE',
            summary: '多站址比较帮助优化选址决策',
        },
    }),

    // ============ 报告类 ============

    generateReport: (): ActionCard => ({
        id: 'generate_report',
        title: '📊 生成决策报告',
        description: '导出专业 PDF 报告，向领导/投资人汇报',
        priority: 2,
        category: 'REPORT',
        cta: {
            type: 'NAVIGATE',
            target: '/projects/report',
        },
        rationale: {
            type: 'RULE',
            summary: '收益测算已完成，可生成报告',
        },
    }),

    // ============ 运维诊断类 ============

    startRecording: (): ActionCard => ({
        id: 'start_recording',
        title: '📝 开始记录发电数据',
        description: '每日记录发电量，追踪电站表现',
        priority: 1,
        category: 'DIAGNOSIS',
        cta: {
            type: 'NAVIGATE',
            target: '/station/record',
        },
        rationale: {
            type: 'RULE',
            summary: '电站已关联，建议开始记录运行数据',
        },
    }),

    analyzePerformance: (): ActionCard => ({
        id: 'analyze_performance',
        title: '📈 性能比(PR)分析',
        description: 'AI 深度分析发电效率，找出损失原因',
        priority: 2,
        category: 'DIAGNOSIS',
        cta: {
            type: 'NAVIGATE',
            target: '/maintenance?type=pr',
        },
        rationale: {
            type: 'DATA',
            summary: '数据量足够进行性能分析',
        },
    }),

    optimizeCleaning: (): ActionCard => ({
        id: 'optimize_cleaning',
        title: '🧹 清洗决策优化',
        description: 'AI 推荐最佳清洗时机，平衡成本与收益',
        priority: 3,
        category: 'DIAGNOSIS',
        cta: {
            type: 'NAVIGATE',
            target: '/maintenance?type=cleaning',
        },
        rationale: {
            type: 'RULE',
            summary: '定期清洗可提升 5-10% 发电量',
        },
    }),

    // ============ 研究类 ============

    searchPapers: (): ActionCard => ({
        id: 'search_papers',
        title: '📚 搜索学术论文',
        description: '查找新能源领域最新研究成果',
        priority: 3,
        category: 'RESEARCH',
        cta: {
            type: 'NAVIGATE',
            target: '/papers',
        },
        rationale: {
            type: 'RULE',
            summary: '了解行业前沿技术和趋势',
        },
    }),

    // ============ 社区类 ============

    askCommunity: (): ActionCard => ({
        id: 'ask_community',
        title: '💬 向社区提问',
        description: '获取专业人士的建议和经验分享',
        priority: 3,
        category: 'COMMUNITY',
        cta: {
            type: 'NAVIGATE',
            target: '/community/new',
        },
        rationale: {
            type: 'RULE',
            summary: '社区有丰富的实践经验',
        },
    }),
};
