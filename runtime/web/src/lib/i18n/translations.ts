// 国际化配置文件
export const defaultLocale = 'zh-CN';
export const locales = ['zh-CN', 'en-US'] as const;
export type Locale = typeof locales[number];

// 通用翻译文本
export const translations: Record<Locale, Record<string, any>> = {
    'zh-CN': {
        // 导航
        nav: {
            home: '首页',
            dashboard: '工作台',
            calculator: '收益测算',
            assistant: 'AI 助手',
            map: '资源地图',
            papers: '文献库',
            pricing: '定价',
            login: '登录',
            logout: '退出登录',
        },
        // 通用
        common: {
            loading: '加载中...',
            error: '出错了',
            retry: '重试',
            save: '保存',
            cancel: '取消',
            confirm: '确认',
            delete: '删除',
            edit: '编辑',
            create: '新建',
            search: '搜索',
            filter: '筛选',
            export: '导出',
            import: '导入',
            more: '更多',
            back: '返回',
            next: '下一步',
            previous: '上一步',
            submit: '提交',
            close: '关闭',
        },
        // 首页
        home: {
            title: '新能源智库',
            subtitle: '智能新能源项目分析与管理平台',
            quickCalc: '快速测算',
            ctaButton: '免费开始使用',
            socialProof: '{count}人已完成测算',
            features: {
                accurate: '精准测算',
                accurateDesc: '基于NASA卫星数据与AI模型',
                ai: 'AI 助手',
                aiDesc: '智能问答与项目诊断',
                map: '资源地图',
                mapDesc: '全球辐照与风速数据',
                papers: '专业文献',
                papersDesc: '行业研究与技术资料',
            }
        },
        // 计算器
        calculator: {
            title: '收益测算',
            solar: '光伏发电',
            wind: '风力发电',
            storage: '储能系统',
            capacity: '装机容量',
            location: '项目地址',
            calculate: '开始测算',
            results: {
                annualGeneration: '年发电量',
                annualRevenue: '年收益',
                paybackPeriod: '投资回收期',
                co2Reduction: 'CO₂减排',
                irr: '内部收益率',
                lcoe: '度电成本',
            }
        },
        // 仪表板
        dashboard: {
            welcome: '欢迎回来',
            overview: '项目概览',
            recentProjects: '最近项目',
            quickActions: '快捷操作',
            stats: {
                totalProjects: '项目总数',
                totalCapacity: '总装机容量',
                totalGeneration: '累计发电',
                carbonReduction: '碳减排',
            }
        },
        // 积分系统
        points: {
            balance: '积分余额',
            earn: '获取积分',
            redeem: '兑换奖励',
            history: '积分明细',
            rules: {
                dailyLogin: '每日登录',
                calculation: '完成测算',
                share: '分享项目',
                invite: '邀请好友',
            }
        }
    },
    'en-US': {
        // Navigation
        nav: {
            home: 'Home',
            dashboard: 'Dashboard',
            calculator: 'Calculator',
            assistant: 'AI Assistant',
            map: 'Resource Map',
            papers: 'Papers',
            pricing: 'Pricing',
            login: 'Login',
            logout: 'Logout',
        },
        // Common
        common: {
            loading: 'Loading...',
            error: 'Error',
            retry: 'Retry',
            save: 'Save',
            cancel: 'Cancel',
            confirm: 'Confirm',
            delete: 'Delete',
            edit: 'Edit',
            create: 'Create',
            search: 'Search',
            filter: 'Filter',
            export: 'Export',
            import: 'Import',
            more: 'More',
            back: 'Back',
            next: 'Next',
            previous: 'Previous',
            submit: 'Submit',
            close: 'Close',
        },
        // Home
        home: {
            title: 'Xinnengyuan',
            subtitle: 'Intelligent Renewable Energy Analysis Platform',
            quickCalc: 'Quick Calculate',
            ctaButton: 'Get Started Free',
            socialProof: '{count} users have calculated',
            features: {
                accurate: 'Accurate Analysis',
                accurateDesc: 'Based on NASA data & AI models',
                ai: 'AI Assistant',
                aiDesc: 'Smart Q&A and diagnostics',
                map: 'Resource Map',
                mapDesc: 'Global irradiance & wind data',
                papers: 'Research Papers',
                papersDesc: 'Industry research & technical docs',
            }
        },
        // Calculator
        calculator: {
            title: 'ROI Calculator',
            solar: 'Solar PV',
            wind: 'Wind Power',
            storage: 'Energy Storage',
            capacity: 'Capacity',
            location: 'Project Location',
            calculate: 'Calculate',
            results: {
                annualGeneration: 'Annual Generation',
                annualRevenue: 'Annual Revenue',
                paybackPeriod: 'Payback Period',
                co2Reduction: 'CO₂ Reduction',
                irr: 'IRR',
                lcoe: 'LCOE',
            }
        },
        // Dashboard
        dashboard: {
            welcome: 'Welcome back',
            overview: 'Overview',
            recentProjects: 'Recent Projects',
            quickActions: 'Quick Actions',
            stats: {
                totalProjects: 'Total Projects',
                totalCapacity: 'Total Capacity',
                totalGeneration: 'Total Generation',
                carbonReduction: 'Carbon Reduction',
            }
        },
        // Points
        points: {
            balance: 'Points Balance',
            earn: 'Earn Points',
            redeem: 'Redeem',
            history: 'History',
            rules: {
                dailyLogin: 'Daily Login',
                calculation: 'Complete Calculation',
                share: 'Share Project',
                invite: 'Invite Friend',
            }
        }
    }
};

// 获取翻译文本
export function t(key: string, locale: Locale = defaultLocale, params?: Record<string, any>): string {
    const keys = key.split('.');
    let value: any = translations[locale];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // 回退到中文
            value = translations['zh-CN'];
            for (const fallbackKey of keys) {
                if (value && typeof value === 'object' && fallbackKey in value) {
                    value = value[fallbackKey];
                } else {
                    return key; // 返回原始key作为fallback
                }
            }
            break;
        }
    }

    if (typeof value === 'string' && params) {
        return value.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
    }

    return typeof value === 'string' ? value : key;
}
