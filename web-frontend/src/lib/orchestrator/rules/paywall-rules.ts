// 项目生命周期编排器 - 付费墙规则

import type { Rule } from '../types';

/**
 * 付费墙触发规则
 * 集中管理所有付费点，避免在各模块散落
 */
export const paywallRules: Rule[] = [
    // 规则：免费用户达到每日限额
    {
        key: 'daily_limit_reached',
        name: '每日限额已满',
        priority: 1,
        when: (ctx) => ctx.signals.dailyLimitReached && ctx.userPlan === 'FREE',
        then: () => ({
            paywallHints: [{
                featureKey: 'DAILY_LIMIT',
                reason: '今日免费额度已用完，升级 PRO 无限使用',
                trigger: { type: 'LIMIT_REACHED', target: 'calculation' },
                planToUpgrade: 'PRO',
            }],
            actions: [{
                id: 'upgrade_daily_limit',
                title: '💎 今日额度已用完',
                description: '升级 PRO 版，无限测算、完整报告',
                priority: 1,
                category: 'SETTINGS',
                cta: {
                    type: 'OPEN_MODAL',
                    target: 'paywall',
                    params: { feature: 'DAILY_LIMIT' },
                },
                rationale: {
                    type: 'RULE',
                    summary: '免费版每日限额已达上限',
                },
                requiresPlan: 'PRO',
            }],
        }),
    },

    // 规则：免费用户想导出报告
    {
        key: 'export_blocked',
        name: '导出功能受限',
        priority: 110,
        when: (ctx) =>
            ctx.signals.hasCalculation &&
            ctx.userPlan === 'FREE',
        then: () => ({
            paywallHints: [{
                featureKey: 'EXPORT_PDF',
                reason: '导出 PDF 报告需要 PRO 版',
                trigger: { type: 'EXPORT', target: 'report' },
                planToUpgrade: 'PRO',
            }],
        }),
    },

    // 规则：免费用户想用高级诊断
    {
        key: 'advanced_diagnosis_blocked',
        name: '高级诊断受限',
        priority: 111,
        when: (ctx) =>
            ctx.signals.hasStation &&
            ctx.userPlan === 'FREE',
        then: () => ({
            paywallHints: [
                {
                    featureKey: 'IV_ANALYSIS',
                    reason: 'IV 曲线分析需要 PRO 版',
                    trigger: { type: 'CLICK', target: 'iv_analysis' },
                    planToUpgrade: 'PRO',
                },
                {
                    featureKey: 'STRING_ANALYSIS',
                    reason: '组串分析需要 PRO 版',
                    trigger: { type: 'CLICK', target: 'string_analysis' },
                    planToUpgrade: 'PRO',
                },
                {
                    featureKey: 'PREDICTIVE_MAINTENANCE',
                    reason: '预测性维护需要 PRO 版',
                    trigger: { type: 'CLICK', target: 'predictive' },
                    planToUpgrade: 'PRO',
                },
            ],
        }),
    },

    // 规则：免费用户论文数量限制
    {
        key: 'paper_limit',
        name: '论文收藏限制',
        priority: 112,
        when: (ctx) =>
            ctx.signals.paperCount >= 10 &&
            ctx.userPlan === 'FREE',
        then: () => ({
            paywallHints: [{
                featureKey: 'PAPER_LIMIT',
                reason: '免费版最多收藏 10 篇论文，升级解锁无限收藏',
                trigger: { type: 'LIMIT_REACHED', target: 'papers' },
                planToUpgrade: 'PRO',
            }],
        }),
    },

    // 规则：企业版功能
    {
        key: 'enterprise_features',
        name: '企业版功能',
        priority: 120,
        when: (ctx) => ctx.userPlan !== 'ENTERPRISE',
        then: () => ({
            paywallHints: [
                {
                    featureKey: 'MULTI_PROJECT',
                    reason: '多项目组合分析需要企业版',
                    trigger: { type: 'CLICK', target: 'portfolio' },
                    planToUpgrade: 'ENTERPRISE',
                },
                {
                    featureKey: 'TEAM_MANAGEMENT',
                    reason: '团队协作需要企业版',
                    trigger: { type: 'CLICK', target: 'team' },
                    planToUpgrade: 'ENTERPRISE',
                },
                {
                    featureKey: 'API_ACCESS',
                    reason: 'API 调用需要企业版',
                    trigger: { type: 'CLICK', target: 'api' },
                    planToUpgrade: 'ENTERPRISE',
                },
            ],
        }),
    },
];
