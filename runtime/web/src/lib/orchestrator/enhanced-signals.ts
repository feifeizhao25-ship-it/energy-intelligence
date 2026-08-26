/**
 * 增强的信号系统 - Enhanced Signals
 * 
 * 在原有信号基础上，添加：
 * 1. 证据完整性评估
 * 2. 可交付性评估
 * 3. 风险信号
 * 
 * 用于编排器做出更智能的决策
 */

import { AssumptionManager } from '../kernel/assumption-manager';
import { EvidenceValidator } from '../kernel/evidence-chain';
import { ResultValidator, QualityTag } from '../kernel/calculation-result';

/**
 * 证据完整性评估
 */
export interface EvidenceCompletenessSignal {
    /** 太阳辐照数据是否存在 */
    solarResource: boolean;

    /** 电价政策是否存在 */
    electricityPrice: boolean;

    /** 监测数据是否存在 */
    monitoringData: boolean;

    /** 政策文件是否存在 */
    regulatoryDocs: boolean;

    /** 整体完整性评分 0-1 */
    score: number;

    /** 缺失的关键证据 */
    missingCritical: string[];

    /** 缺失的可选证据 */
    missingOptional: string[];
}

/**
 * 可交付性评估
 */
export interface DeliverabilityScoreSignal {
    /** 口径版本是否明确 */
    assumptionVersionDefined: boolean;

    /** 证据链是否完整 */
    evidenceChainComplete: boolean;

    /** 不确定性是否已分析 */
    uncertaintyAnalyzed: boolean;

    /** 报告模板是否就绪 */
    reportTemplateReady: boolean;

    /** 合规标准是否引用 */
    regulatoryComplianceOK: boolean;

    /** 整体可交付性评分 0-1 */
    score: number;

    /** 可生成的交付物类型 */
    availableDeliverables: Array<"PREVIEW" | "STANDARD_REPORT" | "AUDIT_REPORT">;

    /** 阻碍因素 */
    blockers: string[];
}

/**
 * 风险信号
 */
export interface RiskSignals {
    /** 数据质量风险 */
    dataQualityRisk: "LOW" | "MEDIUM" | "HIGH";

    /** 口径是否过时 */
    assumptionOutdated: boolean;

    /** 合规差距 */
    complianceGap: string[];

    /** 权限风险（用户是否有足够权限） */
    permissionRisk: "NONE" | "LIMITED" | "BLOCKED";

    /** 成本风险（操作成本是否过高） */
    costRisk: "LOW" | "MEDIUM" | "HIGH";

    /** 总风险评级 */
    overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

    /** 风险详情 */
    riskDetails: Array<{
        type: string;
        severity: "LOW" | "MEDIUM" | "HIGH";
        description: string;
        mitigation?: string;
    }>;
}

/**
 * 增强的信号（扩展BaseSignals）
 */
export interface EnhancedSignals {
    /** 原有信号保持兼容 */
    hasProject: boolean;
    hasCalculation: boolean;
    hasDiagnosis: boolean;
    hasMonitoring: boolean;

    /** 项目阶段 */
    stage: "PLANNING" | "DESIGN" | "CONSTRUCTION" | "OPERATIONS" | "OPTIMIZATION";

    /** 新增：证据完整性 */
    evidenceCompleteness: EvidenceCompletenessSignal;

    /** 新增：可交付性评估 */
    deliverabilityScore: DeliverabilityScoreSignal;

    /** 新增：风险信号 */
    riskSignals: RiskSignals;

    /** 计算质量等级（已有结果的最高质量） */
    currentQualityTag?: QualityTag;

    /** 推荐的下一步质量等级 */
    recommendedQualityTag: QualityTag;

    /** 是否需要升级质量 */
    needsQualityUpgrade: boolean;
}

/**
 * 信号生成器 - 增强版
 */
export class EnhancedSignalGenerator {
    /**
     * 生成项目的增强信号
     */
    static async generate(
        projectId: string,
        userId: string,
        userPlan: string
    ): Promise<EnhancedSignals> {
        // 1. 获取项目基础数据
        const project = await this.getProjectData(projectId);

        // 2. 评估证据完整性
        const evidenceCompleteness = await this.assessEvidenceCompleteness(project);

        // 3. 评估可交付性
        const deliverabilityScore = await this.assessDeliverability(project);

        // 4. 评估风险
        const riskSignals = await this.assessRisks(project, userId, userPlan);

        // 5. 确定当前和推荐质量等级
        const currentQualityTag = this.getCurrentQualityTag(project);
        const recommendedQualityTag = this.recommendQualityTag(
            project,
            deliverabilityScore,
            riskSignals,
            userPlan
        );

        return {
            // 原有信号
            hasProject: !!project,
            hasCalculation: project?.calculations?.length > 0,
            hasDiagnosis: project?.diagnoses?.length > 0,
            hasMonitoring: project?.hasMonitoring || false,
            stage: project?.stage || "PLANNING",

            // 新增信号
            evidenceCompleteness,
            deliverabilityScore,
            riskSignals,
            currentQualityTag,
            recommendedQualityTag,
            needsQualityUpgrade: this.needsUpgrade(currentQualityTag, recommendedQualityTag)
        };
    }

    /**
     * 评估证据完整性
     */
    private static async assessEvidenceCompleteness(project: any): Promise<EvidenceCompletenessSignal> {
        const has = {
            solarResource: !!project?.solarResourceData,
            electricityPrice: !!project?.electricityPricePolicy,
            monitoringData: !!project?.monitoringRecords?.length,
            regulatoryDocs: !!project?.regulatoryDocuments?.length
        };

        // 计算评分
        const weights = {
            solarResource: 0.4,    // 最关键
            electricityPrice: 0.3,
            monitoringData: 0.2,
            regulatoryDocs: 0.1
        };

        const score = Object.entries(has).reduce((sum, [key, value]) => {
            return sum + (value ? weights[key as keyof typeof weights] : 0);
        }, 0);

        // 识别缺失项
        const missingCritical = [];
        const missingOptional = [];

        if (!has.solarResource) missingCritical.push("太阳辐照数据");
        if (!has.electricityPrice) missingCritical.push("电价政策");
        if (!has.monitoringData) missingOptional.push("监测数据");
        if (!has.regulatoryDocs) missingOptional.push("政策文件");

        return {
            ...has,
            score,
            missingCritical,
            missingOptional
        };
    }

    /**
     * 评估可交付性
     */
    private static async assessDeliverability(project: any): Promise<DeliverabilityScoreSignal> {
        const latestCalculation = project?.calculations?.[0];

        const checks = {
            assumptionVersionDefined: !!latestCalculation?.auditMeta?.assumptionVersion,
            evidenceChainComplete: !!latestCalculation?.evidenceChain,
            uncertaintyAnalyzed: !!latestCalculation?.evidenceChain?.uncertaintyAnalysis,
            reportTemplateReady: true, // 模板总是可用
            regulatoryComplianceOK:
                (latestCalculation?.evidenceChain?.regulatoryCompliance?.length || 0) > 0
        };

        // 计算评分
        const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;

        // 确定可用交付物
        const availableDeliverables: Array<"PREVIEW" | "STANDARD_REPORT" | "AUDIT_REPORT"> = ["PREVIEW"];

        if (checks.assumptionVersionDefined && checks.evidenceChainComplete) {
            availableDeliverables.push("STANDARD_REPORT");
        }

        if (checks.uncertaintyAnalyzed && checks.regulatoryComplianceOK) {
            availableDeliverables.push("AUDIT_REPORT");
        }

        // 识别阻碍因素
        const blockers = [];
        if (!checks.assumptionVersionDefined) blockers.push("缺少口径版本");
        if (!checks.evidenceChainComplete) blockers.push("证据链不完整");
        if (!checks.uncertaintyAnalyzed) blockers.push("未进行不确定性分析");
        if (!checks.regulatoryComplianceOK) blockers.push("缺少合规标准引用");

        return {
            ...checks,
            score,
            availableDeliverables,
            blockers
        };
    }

    /**
     * 评估风险
     */
    private static async assessRisks(
        project: any,
        userId: string,
        userPlan: string
    ): Promise<RiskSignals> {
        const risks = {
            dataQualityRisk: "LOW" as "LOW" | "MEDIUM" | "HIGH",
            assumptionOutdated: false,
            complianceGap: [] as string[],
            permissionRisk: "NONE" as "NONE" | "LIMITED" | "BLOCKED",
            costRisk: "LOW" as "LOW" | "MEDIUM" | "HIGH",
            overallRisk: "LOW" as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            riskDetails: [] as Array<{
                type: string;
                severity: "LOW" | "MEDIUM" | "HIGH";
                description: string;
                mitigation?: string;
            }>
        };

        // 检查数据质量
        const latestCalc = project?.calculations?.[0];
        if (latestCalc) {
            const dataAge = Date.now() - new Date(latestCalc.createdAt).getTime();
            const daysOld = dataAge / (1000 * 60 * 60 * 24);

            if (daysOld > 365) {
                risks.dataQualityRisk = "HIGH";
                risks.riskDetails.push({
                    type: "DATA_QUALITY",
                    severity: "HIGH",
                    description: `计算数据已过时（${Math.floor(daysOld)}天前）`,
                    mitigation: "建议重新计算以获取最新结果"
                });
            } else if (daysOld > 90) {
                risks.dataQualityRisk = "MEDIUM";
                risks.riskDetails.push({
                    type: "DATA_QUALITY",
                    severity: "MEDIUM",
                    description: `计算数据较旧（${Math.floor(daysOld)}天前）`,
                    mitigation: "考虑更新计算结果"
                });
            }
        }

        // 检查口径版本
        const currentVersion = AssumptionManager.getCurrentVersion();
        if (latestCalc?.auditMeta?.assumptionVersion !== currentVersion.id) {
            risks.assumptionOutdated = true;
            risks.riskDetails.push({
                type: "ASSUMPTION_VERSION",
                severity: "MEDIUM",
                description: `使用的口径版本(${latestCalc?.auditMeta?.assumptionVersion})不是最新版本(${currentVersion.id})`,
                mitigation: "建议使用最新口径重新计算"
            });
        }

        // 检查权限
        if (!userId) {
            risks.permissionRisk = "BLOCKED";
            risks.riskDetails.push({
                type: "PERMISSION",
                severity: "HIGH",
                description: "未登录，部分功能受限"
            });
        } else if (!['PRO', 'ENTERPRISE', 'FULL'].includes(userPlan)) {
            risks.permissionRisk = "LIMITED";
            risks.riskDetails.push({
                type: "PERMISSION",
                severity: "LOW",
                description: "免费计划，审计级功能需要升级",
                mitigation: "升级到Pro计划解锁审计级功能"
            });
        }

        // 检查合规性
        if (!latestCalc?.evidenceChain?.regulatoryCompliance?.length) {
            risks.complianceGap.push("缺少行业标准引用");
            risks.riskDetails.push({
                type: "COMPLIANCE",
                severity: "MEDIUM",
                description: "计算结果未引用行业标准",
                mitigation: "添加IEC/NREL等标准引用"
            });
        }

        // 计算总风险
        const highCount = risks.riskDetails.filter(r => r.severity === "HIGH").length;
        const mediumCount = risks.riskDetails.filter(r => r.severity === "MEDIUM").length;

        if (highCount >= 2) {
            risks.overallRisk = "CRITICAL";
        } else if (highCount >= 1 || mediumCount >= 3) {
            risks.overallRisk = "HIGH";
        } else if (mediumCount >= 1) {
            risks.overallRisk = "MEDIUM";
        }

        return risks;
    }

    /**
     * 获取当前质量等级
     */
    private static getCurrentQualityTag(project: any): QualityTag | undefined {
        const latestCalc = project?.calculations?.[0];
        return latestCalc?.qualityTag as QualityTag;
    }

    /**
     * 推荐质量等级
     */
    private static recommendQualityTag(
        project: any,
        deliverability: DeliverabilityScoreSignal,
        risks: RiskSignals,
        userPlan: string
    ): QualityTag {
        // 如果是企业用户 + 可交付性高 + 风险低 → 推荐审计级
        if (
            ['PRO', 'ENTERPRISE', 'FULL'].includes(userPlan) &&
            deliverability.score >= 0.8 &&
            risks.overallRisk === "LOW"
        ) {
            return "AUDIT_GRADE";
        }

        // 如果证据链完整 → 推荐标准级
        if (deliverability.evidenceChainComplete) {
            return "STANDARD";
        }

        // 默认预览级
        return "PREVIEW";
    }

    /**
     * 判断是否需要升级质量
     */
    private static needsUpgrade(
        current: QualityTag | undefined,
        recommended: QualityTag
    ): boolean {
        if (!current) return true;

        const levels = { PREVIEW: 1, STANDARD: 2, AUDIT_GRADE: 3 };
        return levels[current] < levels[recommended];
    }

    /**
     * 获取项目数据（模拟）
     */
    private static async getProjectData(projectId: string): Promise<any> {
        // TODO: 实际从数据库获取
        return {
            id: projectId,
            stage: "PLANNING",
            calculations: [],
            diagnoses: [],
            solarResourceData: null,
            electricityPricePolicy: null,
            monitoringRecords: [],
            regulatoryDocuments: []
        };
    }
}

/**
 * 使用示例：
 * 
 * const signals = await EnhancedSignalGenerator.generate(
 *   projectId,
 *   userId,
 *   userPlan
 * );
 * 
 * // 检查证据完整性
 * if (signals.evidenceCompleteness.score < 0.8) {
 *   console.log("缺失证据:", signals.evidenceCompleteness.missingCritical);
 * }
 * 
 * // 检查可交付性
 * if (signals.deliverabilityScore.availableDeliverables.includes("AUDIT_REPORT")) {
 *   console.log("可生成审计报告");
 * }
 * 
 * // 检查风险
 * if (signals.riskSignals.overallRisk === "HIGH") {
 *   signals.riskSignals.riskDetails.forEach(risk => {
 *     console.log(`${risk.type}: ${risk.description}`);
 *   });
 * }
 * 
 * // 推荐质量升级
 * if (signals.needsQualityUpgrade) {
 *   console.log(`建议升级到${signals.recommendedQualityTag}`);
 * }
 */
