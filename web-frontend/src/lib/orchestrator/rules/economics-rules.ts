// 项目生命周期编排器 - 收益计算规则

import type { Rule } from '../types';
import { ACTION_TEMPLATES } from '../templates/action-templates';

/**
 * 收益计算相关规则
 */
export const economicsRules: Rule[] = [
    // 规则：有资源评估但没有计算 → 推荐进行收益测算
    {
        key: 'no_calculation',
        name: '未进行收益测算',
        priority: 30,
        when: (ctx) =>
            (ctx.signals.hasSolarResource || ctx.signals.hasWindResource) &&
            !ctx.signals.hasCalculation,
        then: (ctx) => ({
            actions: [
                ctx.signals.hasSolarResource
                    ? ACTION_TEMPLATES.calculateSolar()
                    : ACTION_TEMPLATES.calculateWind()
            ],
        }),
    },

    // 规则：已有预览计算但未解锁完整版 → 推荐升级查看详情
    {
        key: 'preview_only',
        name: '仅有预览结果',
        priority: 40,
        when: (ctx) =>
            ctx.signals.hasCalculation &&
            ctx.signals.calculationQuality === 'PREVIEW' &&
            ctx.userPlan === 'FREE',
        then: () => ({
            actions: [ACTION_TEMPLATES.unlockFullAnalysis()],
            paywallHints: [{
                featureKey: 'IRR_DETAIL',
                reason: '查看完整 IRR 与 25 年现金流预测',
                trigger: { type: 'CLICK', target: 'calculation_detail' },
                planToUpgrade: 'PRO',
            }],
        }),
    },

    // 规则：IRR 很高（>15%）→ 提示优质项目
    {
        key: 'high_irr',
        name: 'IRR 优秀',
        priority: 50,
        when: (ctx) => ctx.signals.irr !== undefined && ctx.signals.irr > 0.15,
        then: (ctx) => ({
            actions: [{
                id: 'high_irr_tip',
                title: '🎯 优质投资机会',
                description: `IRR 达到 ${((ctx.signals.irr || 0) * 100).toFixed(1)}%，远超银行理财`,
                priority: 1,
                category: 'CALCULATION',
                cta: {
                    type: 'NAVIGATE',
                    target: `/projects/${ctx.projectId}/result`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '投资回报率表现优异',
                    evidence: [
                        `内部收益率 ${((ctx.signals.irr || 0) * 100).toFixed(1)}%`,
                        '是银行理财收益的 5-8 倍',
                    ],
                },
            }],
        }),
    },

    // 规则：回本周期过长（>10年）→ 提示风险
    {
        key: 'long_payback',
        name: '回本周期较长',
        priority: 51,
        when: (ctx) => ctx.signals.paybackYears !== undefined && ctx.signals.paybackYears > 10,
        then: (ctx) => ({
            actions: [{
                id: 'long_payback_warning',
                title: '⚠️ 回本周期较长',
                description: `预计 ${ctx.signals.paybackYears?.toFixed(1)} 年回本，建议优化方案`,
                priority: 2,
                category: 'CALCULATION',
                cta: {
                    type: 'NAVIGATE',
                    target: `/projects/${ctx.projectId}/optimize`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '回本周期超过 10 年可能增加风险',
                    evidence: [
                        '建议尝试调整装机容量',
                        '考虑不同融资方案',
                        '关注当地补贴政策',
                    ],
                },
            }],
        }),
    },

    // 规则：只有一种类型计算 → 推荐对比其他类型
    {
        key: 'single_type_calc',
        name: '单一类型测算',
        priority: 60,
        when: (ctx) =>
            ctx.signals.hasCalculation &&
            !ctx.signals.hasSiteComparison &&
            ctx.signals.hasSolarResource &&
            ctx.signals.hasWindResource,
        then: () => ({
            actions: [ACTION_TEMPLATES.compareSites()],
        }),
    },

    // 规则：有完整计算但没有报告 → 推荐生成报告
    {
        key: 'no_report',
        name: '未生成报告',
        priority: 70,
        when: (ctx) =>
            ctx.signals.hasCalculation &&
            ctx.signals.calculationQuality === 'FULL' &&
            !ctx.signals.hasReport,
        then: () => ({
            actions: [ACTION_TEMPLATES.generateReport()],
        }),
    },
];
