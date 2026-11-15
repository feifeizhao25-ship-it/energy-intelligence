// 项目生命周期编排器 - 资源评估规则

import type { Rule } from '../types';
import { ACTION_TEMPLATES } from '../templates/action-templates';

/**
 * 资源评估相关规则
 */
export const resourceRules: Rule[] = [
    // 规则：没有位置 → 推荐先设置位置
    {
        key: 'no_location',
        name: '缺少位置信息',
        priority: 10,
        when: (ctx) => !ctx.signals.hasLocation,
        then: () => ({
            actions: [ACTION_TEMPLATES.setLocation()],
        }),
    },

    // 规则：有位置但没有太阳能资源 → 推荐获取资源评估
    {
        key: 'no_solar_resource',
        name: '缺少太阳能资源评估',
        priority: 20,
        when: (ctx) => ctx.signals.hasLocation && !ctx.signals.hasSolarResource,
        then: () => ({
            actions: [ACTION_TEMPLATES.getSolarResource()],
        }),
    },

    // 规则：有位置但没有风能资源（且项目类型是风电或混合）
    {
        key: 'no_wind_resource',
        name: '缺少风能资源评估',
        priority: 21,
        when: (ctx) =>
            ctx.signals.hasLocation &&
            !ctx.signals.hasWindResource &&
            (ctx.signals.projectType === 'WIND' || ctx.signals.projectType === 'HYBRID'),
        then: () => ({
            actions: [ACTION_TEMPLATES.getWindResource()],
        }),
    },

    // 资源读数落在样本高位时只说明区间，不写成开发建议。
    {
        key: 'excellent_resource',
        name: '资源读数处于样本高位',
        priority: 100,
        when: (ctx) => ctx.signals.resourceRating === 'EXCELLENT',
        then: () => ({
            actions: [{
                id: 'resource_excellent_tip',
                title: '年辐照处于样本高位',
                description: '该坐标的年辐照读数高于 1500 kWh/m²。这是样本区间，不是该点实测，也不表示项目是否适合建设。',
                priority: 3,
                category: 'RESOURCE',
                cta: {
                    type: 'NAVIGATE',
                    target: `/quick-calc/solar`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '年辐照相对 1500 kWh/m² 的位置',
                    evidence: ['年辐照量 > 1500 kWh/m²', '样本高位区间'],
                },
            }],
        }),
    },

    // 规则：资源较差 → 建议谨慎评估
    {
        key: 'poor_resource',
        name: '资源读数处于样本低位',
        priority: 101,
        when: (ctx) => ctx.signals.resourceRating === 'POOR',
        then: () => ({
            actions: [{
                id: 'resource_poor_warning',
                title: '年辐照处于样本低位',
                description: '该坐标的年辐照读数低于样本中位。这是样本区间，不是该点实测。',
                priority: 2,
                category: 'RESOURCE',
                cta: {
                    type: 'NAVIGATE',
                    target: `/quick-calc/solar`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '年辐照相对样本中位的位置',
                    evidence: ['年辐照低于样本中位', '读数随输入坐标变化'],
                },
            }],
        }),
    },
];
