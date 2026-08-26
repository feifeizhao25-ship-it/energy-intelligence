// 项目生命周期编排器 - 阶段判定器
// 根据项目信号自动推断当前生命周期阶段

import type { LifecycleStage, Signals, STAGE_META } from './types';

interface StageResolverResult {
    stage: LifecycleStage;
    confidence: number;
    reason: string;
}

/**
 * 阶段判定规则（按优先级排序）
 * 规则设计原则：
 * 1. 有明确信号的阶段优先
 * 2. 后期阶段比前期阶段优先（用户已经走过来了）
 * 3. 异常状态优先于正常状态
 */
const STAGE_RULES: Array<{
    stage: LifecycleStage;
    check: (s: Signals) => boolean;
    confidence: number;
    reason: string;
}> = [
        // 最高优先：有异常需要诊断
        {
            stage: 'ABNORMAL_DIAGNOSIS',
            check: (s) => s.hasDiagnosis && s.lastDiagnosisSeverity === 'HIGH',
            confidence: 0.95,
            reason: '检测到严重异常，需要立即诊断处理',
        },
        {
            stage: 'ABNORMAL_DIAGNOSIS',
            check: (s) => s.lastPR !== undefined && s.lastPR < 0.65,
            confidence: 0.9,
            reason: '性能比(PR)低于 65%，建议进行异常诊断',
        },

        // 运维阶段：有电站且有记录
        {
            stage: 'MAINTENANCE_OPTIMIZATION',
            check: (s) => s.hasStation && s.recordCount >= 30,
            confidence: 0.85,
            reason: '电站运行超过 30 天，可进行维护优化分析',
        },
        {
            stage: 'OPERATION_MONITORING',
            check: (s) => s.hasStation && s.hasStationRecords,
            confidence: 0.9,
            reason: '电站已投运，处于运行监控阶段',
        },

        // 决策阶段：有报告
        {
            stage: 'DECISION_REPORTING',
            check: (s) => s.hasReport,
            confidence: 0.85,
            reason: '已生成决策报告',
        },

        // 优化阶段：有多次计算或站址比选
        {
            stage: 'DESIGN_OPTIMIZATION',
            check: (s) => s.hasSiteComparison,
            confidence: 0.9,
            reason: '正在进行站址比选与方案优化',
        },

        // 收益测算阶段：有计算记录
        {
            stage: 'ECONOMIC_EVALUATION',
            check: (s) => s.hasCalculation,
            confidence: 0.9,
            reason: '已完成收益测算',
        },

        // 选址阶段：有资源评估
        {
            stage: 'SITE_SELECTION',
            check: (s) => s.hasSolarResource || s.hasWindResource,
            confidence: 0.85,
            reason: '已获取资源数据，正在选址评估',
        },
        {
            stage: 'SITE_SELECTION',
            check: (s) => s.hasLocation && !s.hasSolarResource && !s.hasWindResource,
            confidence: 0.7,
            reason: '已设定位置，建议获取资源评估',
        },

        // 知识研究：有论文收藏但无项目进展
        {
            stage: 'KNOWLEDGE_RESEARCH',
            check: (s) => s.paperCount > 0 && !s.hasCalculation && !s.hasStation,
            confidence: 0.6,
            reason: '正在进行文献研究',
        },

        // 默认：新手入门
        {
            stage: 'ONBOARDING',
            check: () => true,
            confidence: 0.5,
            reason: '项目刚创建，建议从选址开始',
        },
    ];

/**
 * 解析项目当前生命周期阶段
 */
export function resolveStage(signals: Signals): StageResolverResult {
    for (const rule of STAGE_RULES) {
        if (rule.check(signals)) {
            return {
                stage: rule.stage,
                confidence: rule.confidence,
                reason: rule.reason,
            };
        }
    }

    // 不应该到这里，但保险起见
    return {
        stage: 'ONBOARDING',
        confidence: 0.5,
        reason: '无法确定阶段，默认为新手入门',
    };
}

/**
 * 获取阶段进度百分比
 * 用于 UI 进度条展示
 */
export function getStageProgress(stage: LifecycleStage, signals: Signals): number {
    const stageOrder: Record<LifecycleStage, number> = {
        ONBOARDING: 0,
        SITE_SELECTION: 1,
        ECONOMIC_EVALUATION: 2,
        DESIGN_OPTIMIZATION: 3,
        DECISION_REPORTING: 4,
        CONSTRUCTION_PREP: 5,
        OPERATION_MONITORING: 6,
        ABNORMAL_DIAGNOSIS: 6.5,
        MAINTENANCE_OPTIMIZATION: 7,
        KNOWLEDGE_RESEARCH: -1, // 独立阶段
    };

    const order = stageOrder[stage];
    if (order < 0) return 0; // 独立阶段不计入进度

    // 计算阶段内的细分进度
    let inStageProgress = 0;

    switch (stage) {
        case 'ONBOARDING':
            if (signals.hasLocation) inStageProgress = 0.5;
            if (signals.hasCapacity) inStageProgress = 1;
            break;
        case 'SITE_SELECTION':
            if (signals.hasSolarResource || signals.hasWindResource) inStageProgress = 0.5;
            if (signals.hasSolarResource && signals.hasWindResource) inStageProgress = 1;
            break;
        case 'ECONOMIC_EVALUATION':
            if (signals.hasCalculation) inStageProgress = 0.5;
            if (signals.calculationQuality === 'FULL') inStageProgress = 1;
            break;
        case 'DESIGN_OPTIMIZATION':
            if (signals.hasSiteComparison) inStageProgress = 1;
            break;
        case 'DECISION_REPORTING':
            if (signals.hasReport) inStageProgress = 1;
            break;
        case 'OPERATION_MONITORING':
            const recordRatio = Math.min(signals.recordCount / 30, 1);
            inStageProgress = recordRatio;
            break;
        default:
            inStageProgress = 0.5;
    }

    // 总进度 = 阶段进度 + 阶段内进度
    const maxStage = 7;
    return Math.round(((order + inStageProgress) / maxStage) * 100);
}

/**
 * 获取下一个目标阶段
 */
export function getNextStage(currentStage: LifecycleStage): LifecycleStage | null {
    const progression: Record<LifecycleStage, LifecycleStage | null> = {
        ONBOARDING: 'SITE_SELECTION',
        SITE_SELECTION: 'ECONOMIC_EVALUATION',
        ECONOMIC_EVALUATION: 'DESIGN_OPTIMIZATION',
        DESIGN_OPTIMIZATION: 'DECISION_REPORTING',
        DECISION_REPORTING: 'CONSTRUCTION_PREP',
        CONSTRUCTION_PREP: 'OPERATION_MONITORING',
        OPERATION_MONITORING: 'MAINTENANCE_OPTIMIZATION',
        ABNORMAL_DIAGNOSIS: 'MAINTENANCE_OPTIMIZATION',
        MAINTENANCE_OPTIMIZATION: null,
        KNOWLEDGE_RESEARCH: 'SITE_SELECTION',
    };

    return progression[currentStage];
}
