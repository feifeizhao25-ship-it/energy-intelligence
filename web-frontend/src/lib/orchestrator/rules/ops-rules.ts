// 项目生命周期编排器 - 运维诊断规则

import type { Rule } from '../types';
import { ACTION_TEMPLATES } from '../templates/action-templates';

/**
 * 运维诊断相关规则
 */
export const opsRules: Rule[] = [
    // 规则：有电站但没有记录 → 推荐开始记录
    {
        key: 'station_no_records',
        name: '电站无记录',
        priority: 80,
        when: (ctx) => ctx.signals.hasStation && !ctx.signals.hasStationRecords,
        then: () => ({
            actions: [ACTION_TEMPLATES.startRecording()],
        }),
    },

    // 规则：记录超过7天 → 推荐查看趋势
    {
        key: 'records_7days',
        name: '满7天记录',
        priority: 85,
        when: (ctx) => ctx.signals.recordCount >= 7 && ctx.signals.recordCount < 30,
        then: (ctx) => ({
            actions: [{
                id: 'view_weekly_trend',
                title: '📊 查看本周发电趋势',
                description: `已记录 ${ctx.signals.recordCount} 天，累计发电 ${ctx.signals.totalGeneration.toFixed(0)} kWh`,
                priority: 2,
                category: 'DIAGNOSIS',
                cta: {
                    type: 'NAVIGATE',
                    target: `/projects/${ctx.projectId}/station/charts`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '数据量足够生成趋势分析',
                },
            }],
        }),
    },

    // 规则：PR 低于 0.75 → 推荐诊断
    {
        key: 'low_pr_warning',
        name: 'PR 偏低警告',
        priority: 90,
        when: (ctx) => ctx.signals.lastPR !== undefined && ctx.signals.lastPR < 0.75 && ctx.signals.lastPR >= 0.65,
        then: (ctx) => ({
            actions: [{
                id: 'pr_warning',
                title: '⚠️ 性能比偏低',
                description: `PR = ${((ctx.signals.lastPR || 0) * 100).toFixed(1)}%，低于行业基准(80%)`,
                priority: 2,
                category: 'DIAGNOSIS',
                cta: {
                    type: 'NAVIGATE',
                    target: `/maintenance?type=pr&projectId=${ctx.projectId}`,
                },
                rationale: {
                    type: 'DATA',
                    summary: '可能存在积灰或设备效率问题',
                    evidence: ['建议进行 PR 深度分析', '检查逆变器运行状态'],
                },
            }],
        }),
    },

    // 规则：PR 严重偏低（<0.65）→ 紧急诊断
    {
        key: 'critical_pr',
        name: 'PR 严重偏低',
        priority: 5, // 最高优先
        when: (ctx) => ctx.signals.lastPR !== undefined && ctx.signals.lastPR < 0.65,
        then: (ctx) => ({
            actions: [{
                id: 'pr_critical',
                title: '🚨 紧急：性能比严重偏低',
                description: `PR = ${((ctx.signals.lastPR || 0) * 100).toFixed(1)}%，需要立即诊断`,
                priority: 1,
                category: 'DIAGNOSIS',
                cta: {
                    type: 'NAVIGATE',
                    target: `/maintenance?type=full&projectId=${ctx.projectId}`,
                },
                rationale: {
                    type: 'RULE',
                    summary: 'PR 低于 65% 触发紧急诊断',
                    evidence: [
                        '可能原因：逆变器故障',
                        '可能原因：组件严重积灰或阴影遮挡',
                        '可能原因：组串异常',
                    ],
                },
            }],
        }),
    },

    // 规则：记录超过30天 → 推荐维护优化
    {
        key: 'maintenance_ready',
        name: '可进行维护优化',
        priority: 95,
        when: (ctx) => ctx.signals.recordCount >= 30,
        then: () => ({
            actions: [
                ACTION_TEMPLATES.analyzePerformance(),
                ACTION_TEMPLATES.optimizeCleaning(),
            ],
        }),
    },

    // 规则：没有设置推送 → 推荐开启
    {
        key: 'no_push_subscription',
        name: '未开启推送',
        priority: 200,
        when: (ctx) => ctx.signals.hasStation && ctx.signals.recordCount > 7,
        then: () => ({
            actions: [{
                id: 'enable_push',
                title: '🔔 开启发电推送',
                description: '每天收到发电预报和收益报告',
                priority: 3,
                category: 'SETTINGS',
                cta: {
                    type: 'NAVIGATE',
                    target: '/settings/notifications',
                },
                rationale: {
                    type: 'RULE',
                    summary: '推送有助于持续关注电站运行',
                },
            }],
        }),
    },
];
