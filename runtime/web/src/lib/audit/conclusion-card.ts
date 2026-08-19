// 结论卡片与诊断摘要
// 护城河：统一可交付输出格式

import type { RiskWarning, CalibrationStandard } from './types';

/**
 * 结论卡片
 * 统一所有计算/分析的输出格式
 * 可直接用于报告、导出、展示
 */
export interface ConclusionCard {
    // 唯一标识
    id: string;
    // 标题
    title: string;
    // 结论类型
    type: 'SOLAR_CALC' | 'WIND_CALC' | 'STORAGE_CALC' | 'PR_DIAGNOSIS' | 'COMPARISON' | 'REPORT' | 'CUSTOM';
    // 一句话结论
    headline: string;
    // 结论详情
    summary: string;
    // 核心指标
    keyMetrics: Array<{
        name: string;
        value: number | string;
        unit?: string;
        trend?: 'UP' | 'DOWN' | 'STABLE';
        benchmark?: string;
        calibration?: string; // 引用的口径ID
    }>;
    // 推荐等级
    recommendation: {
        level: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'NEUTRAL' | 'CAUTION' | 'NOT_RECOMMENDED';
        reason: string;
        confidence: number;
    };
    // 风险提示
    risks: RiskWarning[];
    // 下一步建议
    nextSteps: Array<{
        priority: number;
        action: string;
        description: string;
        link?: string;
        requiresPro?: boolean;
    }>;
    // 审计信息
    audit: {
        auditId: string;
        calcVersion: string;
        computedAt: string;
        reproducible: boolean;
    };
    // 可导出性
    exportable: {
        pdf: boolean;
        excel: boolean;
        word: boolean;
        image: boolean;
    };
    // 引用的口径
    calibrations: string[];
    // 原始数据引用
    dataRefs: Array<{
        name: string;
        source: string;
        timestamp: string;
    }>;
    // 创建时间
    createdAt: string;
    // 有效期
    validUntil?: string;
}

/**
 * 诊断摘要
 * 统一所有诊断/分析的输出格式
 */
export interface DiagnosticSummary {
    // 唯一标识
    id: string;
    // 诊断类型
    type: 'PR_ANALYSIS' | 'INVERTER_FAULT' | 'STRING_ANALYSIS' | 'CLEANING_DECISION' | 'PREDICTIVE' | 'THERMAL' | 'VIBRATION' | 'GENERAL';
    // 诊断状态
    status: 'HEALTHY' | 'WARNING' | 'ABNORMAL' | 'CRITICAL' | 'UNKNOWN';
    // 诊断置信度
    confidence: number;
    // 一句话结论
    headline: string;
    // 详细分析
    analysis: string;
    // 关键发现
    findings: Array<{
        severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        issue: string;
        evidence: string[];
        probability?: number;
    }>;
    // 优先级动作
    prioritizedActions: Array<{
        priority: 1 | 2 | 3 | 4 | 5;
        action: string;
        description: string;
        urgency: 'IMMEDIATE' | '24H' | '7D' | '30D' | 'SCHEDULED';
        estimatedCost?: number;
        estimatedBenefit?: number;
        requiresWorkPermit?: boolean;
        requiresShutdown?: boolean;
        riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
    // 证据链
    evidenceChain: Array<{
        step: number;
        description: string;
        data: Record<string, unknown>;
        source: string;
    }>;
    // 损失估算
    lossEstimate?: {
        dailyLoss: number;
        monthlyLoss: number;
        yearlyLoss: number;
        unit: string;
    };
    // 对比基准
    benchmark?: {
        name: string;
        value: number;
        actualValue: number;
        gap: number;
        gapPercentage: number;
    };
    // 历史趋势
    trend?: {
        direction: 'IMPROVING' | 'STABLE' | 'DEGRADING';
        changeRate: number;
        period: string;
    };
    // 审计信息
    audit: {
        auditId: string;
        calcVersion: string;
        computedAt: string;
    };
    // 创建时间
    createdAt: string;
}

/**
 * 创建结论卡片
 */
export function createConclusionCard(params: {
    type: ConclusionCard['type'];
    title: string;
    headline: string;
    summary: string;
    keyMetrics: ConclusionCard['keyMetrics'];
    recommendation: ConclusionCard['recommendation'];
    risks?: RiskWarning[];
    nextSteps?: ConclusionCard['nextSteps'];
    auditId: string;
    calcVersion: string;
    calibrations?: string[];
    dataRefs?: ConclusionCard['dataRefs'];
}): ConclusionCard {
    const now = new Date().toISOString();

    return {
        id: `CC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
        type: params.type,
        title: params.title,
        headline: params.headline,
        summary: params.summary,
        keyMetrics: params.keyMetrics,
        recommendation: params.recommendation,
        risks: params.risks || [],
        nextSteps: params.nextSteps || [],
        audit: {
            auditId: params.auditId,
            calcVersion: params.calcVersion,
            computedAt: now,
            reproducible: true,
        },
        exportable: {
            pdf: true,
            excel: true,
            word: true,
            image: true,
        },
        calibrations: params.calibrations || [],
        dataRefs: params.dataRefs || [],
        createdAt: now,
        validUntil: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), // 7天有效期
    };
}

/**
 * 创建诊断摘要
 */
export function createDiagnosticSummary(params: {
    type: DiagnosticSummary['type'];
    status: DiagnosticSummary['status'];
    confidence: number;
    headline: string;
    analysis: string;
    findings: DiagnosticSummary['findings'];
    prioritizedActions: DiagnosticSummary['prioritizedActions'];
    evidenceChain: DiagnosticSummary['evidenceChain'];
    lossEstimate?: DiagnosticSummary['lossEstimate'];
    benchmark?: DiagnosticSummary['benchmark'];
    auditId: string;
    calcVersion: string;
}): DiagnosticSummary {
    const now = new Date().toISOString();

    return {
        id: `DS-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
        type: params.type,
        status: params.status,
        confidence: params.confidence,
        headline: params.headline,
        analysis: params.analysis,
        findings: params.findings,
        prioritizedActions: params.prioritizedActions.sort((a, b) => a.priority - b.priority),
        evidenceChain: params.evidenceChain,
        lossEstimate: params.lossEstimate,
        benchmark: params.benchmark,
        audit: {
            auditId: params.auditId,
            calcVersion: params.calcVersion,
            computedAt: now,
        },
        createdAt: now,
    };
}

/**
 * 为结论卡片生成推荐等级
 */
export function determineRecommendationLevel(
    irr: number,
    paybackYears: number,
    riskScore: number
): ConclusionCard['recommendation']['level'] {
    if (irr > 0.12 && paybackYears < 7 && riskScore < 30) {
        return 'HIGHLY_RECOMMENDED';
    }
    if (irr > 0.08 && paybackYears < 10 && riskScore < 50) {
        return 'RECOMMENDED';
    }
    if (irr > 0.05 && paybackYears < 15) {
        return 'NEUTRAL';
    }
    if (irr > 0 || riskScore > 70) {
        return 'CAUTION';
    }
    return 'NOT_RECOMMENDED';
}

/**
 * 诊断状态判定
 */
export function determineDiagnosticStatus(
    pr: number,
    findings: DiagnosticSummary['findings']
): DiagnosticSummary['status'] {
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.severity === 'HIGH').length;

    if (criticalCount > 0 || pr < 0.60) {
        return 'CRITICAL';
    }
    if (highCount > 0 || pr < 0.70) {
        return 'ABNORMAL';
    }
    if (pr < 0.80) {
        return 'WARNING';
    }
    return 'HEALTHY';
}
