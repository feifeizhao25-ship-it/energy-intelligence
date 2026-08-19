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

    // 规则：资源评级优秀 → 提示用户
    {
        key: 'excellent_resource',
        name: '资源优秀提示',
        priority: 100,
        when: (ctx) => ctx.signals.resourceRating === 'EXCELLENT',
        then: (ctx) => ({
            actions: [{
                id: 'resource_excellent_tip',
                title: '🌟 资源优秀！',
                description: '您所在位置的太阳能资源评级为"优秀"，非常适合开发光伏项目',
                priority: 3,
                category: 'RESOURCE',
                cta: {
                    type: 'NAVIGATE',
                    target: `/quick-calc/solar`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '基于 NASA POWER 卫星数据评估',
                    evidence: ['年辐照量 > 1500 kWh/m²', '全国排名前 20%'],
                },
            }],
        }),
    },

    // 规则：资源较差 → 建议谨慎评估
    {
        key: 'poor_resource',
        name: '资源较差提示',
        priority: 101,
        when: (ctx) => ctx.signals.resourceRating === 'POOR',
        then: () => ({
            actions: [{
                id: 'resource_poor_warning',
                title: '⚠️ 资源一般',
                description: '该地区太阳能资源偏弱，建议仔细评估投资回报率',
                priority: 2,
                category: 'RESOURCE',
                cta: {
                    type: 'NAVIGATE',
                    target: `/quick-calc/solar`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '年辐照量低于全国平均水平',
                    evidence: ['建议进行详细财务测算', '考虑增加装机容量补偿'],
                },
            }],
        }),
    },
];
