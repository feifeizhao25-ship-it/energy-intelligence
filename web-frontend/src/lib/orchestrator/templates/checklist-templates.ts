// 项目生命周期编排器 - Checklist 模板
// 按阶段定义任务清单

import type { LifecycleStage, ChecklistItem, Signals } from '../types';

/**
 * 各阶段的任务清单模板
 */
const CHECKLIST_TEMPLATES: Record<LifecycleStage, Array<{
    key: string;
    label: string;
    check: (s: Signals) => boolean;
    link?: string;
}>> = {
    ONBOARDING: [
        { key: 'set_location', label: '设置项目位置', check: s => s.hasLocation, link: '/projects/new' },
        { key: 'set_capacity', label: '输入装机容量', check: s => s.hasCapacity },
    ],

    SITE_SELECTION: [
        { key: 'solar_resource', label: '获取太阳能资源', check: s => s.hasSolarResource },
        { key: 'wind_resource', label: '获取风能资源', check: s => s.hasWindResource },
    ],

    ECONOMIC_EVALUATION: [
        { key: 'first_calc', label: '完成首次测算', check: s => s.hasCalculation },
        { key: 'full_calc', label: '解锁完整分析', check: s => s.calculationQuality === 'FULL' },
    ],

    DESIGN_OPTIMIZATION: [
        { key: 'site_compare', label: '站址比选', check: s => s.hasSiteComparison },
    ],

    DECISION_REPORTING: [
        { key: 'generate_report', label: '生成决策报告', check: s => s.hasReport, link: '/projects/report' },
    ],

    CONSTRUCTION_PREP: [
        { key: 'create_station', label: '创建电站', check: s => s.hasStation, link: '/station/new' },
    ],

    OPERATION_MONITORING: [
        { key: 'first_record', label: '录入首条发电记录', check: s => s.hasStationRecords },
        { key: 'week_records', label: '连续记录7天', check: s => s.recordCount >= 7 },
        { key: 'month_records', label: '连续记录30天', check: s => s.recordCount >= 30 },
    ],

    ABNORMAL_DIAGNOSIS: [
        { key: 'pr_analysis', label: '完成 PR 分析', check: s => s.hasDiagnosis },
    ],

    MAINTENANCE_OPTIMIZATION: [
        { key: 'cleaning_decision', label: '获取清洗建议', check: () => false },
        { key: 'predictive', label: '启用预测性维护', check: () => false },
    ],

    KNOWLEDGE_RESEARCH: [
        { key: 'save_paper', label: '收藏首篇论文', check: s => s.paperCount > 0, link: '/papers' },
    ],
};

/**
 * 生成阶段任务清单
 */
export function generateChecklist(
    stage: LifecycleStage,
    signals: Signals
): ChecklistItem[] {
    const template = CHECKLIST_TEMPLATES[stage] || [];

    return template.map(item => ({
        key: item.key,
        label: item.label,
        done: item.check(signals),
        recommended: !item.check(signals),
        link: item.link,
    }));
}

/**
 * 计算阶段完成度
 */
export function getChecklistProgress(
    stage: LifecycleStage,
    signals: Signals
): { completed: number; total: number; percentage: number } {
    const checklist = generateChecklist(stage, signals);
    const completed = checklist.filter(item => item.done).length;
    const total = checklist.length;

    return {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
}
