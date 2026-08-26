// 项目生命周期编排器 - 主入口
// 聚合信号、解析阶段、执行规则，输出统一响应

import type { OrchestratorResponse, RuleContext, STAGE_META as StageMeta } from './types';
import { STAGE_META } from './types';
import { aggregateSignals } from './signals';
import { resolveStage, getStageProgress } from './stage-resolver';
import { RuleEngine, createRuleEngine } from './rules/rule-engine';
import { resourceRules } from './rules/resource-rules';
import { economicsRules } from './rules/economics-rules';
import { opsRules } from './rules/ops-rules';
import { paywallRules } from './rules/paywall-rules';
import { generateChecklist } from './templates/checklist-templates';

// 创建全局规则引擎实例
let ruleEngine: RuleEngine | null = null;

function getRuleEngine(): RuleEngine {
    if (!ruleEngine) {
        ruleEngine = createRuleEngine();
        // 注册所有规则
        ruleEngine.register(resourceRules);
        ruleEngine.register(economicsRules);
        ruleEngine.register(opsRules);
        ruleEngine.register(paywallRules);
    }
    return ruleEngine;
}

/**
 * 构建编排器响应
 * 这是编排器的核心函数，所有前端/AI 调用都通过这里
 */
export async function buildOrchestratorResponse(
    projectId: string,
    userId: string
): Promise<OrchestratorResponse> {
    const startTime = Date.now();

    // 1. 聚合信号
    const signals = await aggregateSignals(projectId, userId);

    // 2. 解析阶段
    const stageResult = resolveStage(signals);
    const stageProgress = getStageProgress(stageResult.stage, signals);

    // 3. 构建规则上下文
    const ctx: RuleContext = {
        signals,
        projectId,
        userId,
        userPlan: signals.userPlan,
    };

    // 4. 执行规则引擎
    const engine = getRuleEngine();
    const ruleResult = engine.execute(ctx);

    // 5. 生成任务清单
    const checklist = generateChecklist(stageResult.stage, signals);

    // 6. 构建项目快照
    const snapshot = {
        location: signals.hasLocation ? {
            lat: 0, // 需要从项目获取实际值
            lng: 0,
        } : undefined,
        type: signals.projectType,
        capacity: signals.hasCapacity ? undefined : undefined,
        lastCalculation: signals.hasCalculation ? {
            type: signals.calculationType!,
            irr: signals.irr,
            paybackYears: signals.paybackYears,
            updatedAt: signals.lastCalculationDate!,
            qualityTag: signals.calculationQuality!,
        } : undefined,
        lastDiagnosis: signals.hasDiagnosis ? {
            type: signals.lastDiagnosisType as 'PR' | 'INVERTER' | 'STRING' | 'IV' | 'CLEANING',
            pr: signals.lastPR,
            severity: signals.lastDiagnosisSeverity,
            updatedAt: '', // 需要从信号中获取
        } : undefined,
        stationStats: signals.hasStation ? {
            totalGeneration: signals.totalGeneration,
            totalRevenue: 0,
            lastRecordDate: signals.lastRecordDate,
            recordCount: signals.recordCount,
        } : undefined,
        paperCount: signals.paperCount,
    };

    // 7. 排序推荐动作（按优先级）
    const sortedActions = ruleResult.actions
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 10); // 最多返回 10 个推荐

    // 8. 构建响应
    const response: OrchestratorResponse = {
        projectId,
        stage: stageResult.stage,
        stageConfidence: stageResult.confidence,
        stageMeta: STAGE_META[stageResult.stage],
        snapshot,
        recommendedActions: sortedActions,
        checklist,
        paywallHints: ruleResult.paywallHints,
        debug: {
            signalsUsed: Object.keys(signals).filter(k => {
                const val = signals[k as keyof typeof signals];
                return val !== undefined && val !== false && val !== 0 && val !== '';
            }),
            rulesFired: ruleResult.rulesFired,
            computedAt: new Date().toISOString(),
            cacheHit: false,
        },
    };

    console.log(`Orchestrator built in ${Date.now() - startTime}ms, stage=${response.stage}, actions=${response.recommendedActions.length}`);

    return response;
}

/**
 * 获取用户所有项目的阶段摘要（用于 Dashboard）
 */
export async function getUserProjectsOverview(userId: string): Promise<Array<{
    projectId: string;
    name: string;
    stage: string;
    stageMeta: typeof StageMeta[keyof typeof StageMeta];
    topAction?: {
        id: string;
        title: string;
        link: string;
    };
}>> {
    // 简化版本：获取项目列表
    // 完整版本需要批量调用 buildOrchestratorResponse
    // TODO: 实现批量聚合以提高性能
    return [];
}
