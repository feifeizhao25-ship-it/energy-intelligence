/**
 * 可交付动作系统 - Deliverable Actions
 * 
 * 编排器不再只是推荐"下一步要做什么"，
 * 而是明确告诉用户：
 * 1. 做完会得到什么交付物
 * 2. 需要什么质量等级
 * 3. 有什么风险
 * 4. 需要什么权限
 * 5. 付费触发点在哪
 */

import { QualityTag } from '../kernel/calculation-result';
import { EnhancedSignals } from './enhanced-signals';

/**
 * 交付物类型
 */
export type DeliverableType =
    | "REPORT"           // 标准报告
    | "CERTIFICATE"      // 证书/合规文件
    | "ANALYSIS"         // 分析报告
    | "RECOMMENDATION"   // 建议方案
    | "TIMELINE"         // 项目时间线
    | "DIAGNOSTIC"       // 诊断报告
    | "COMPARISON";      // 对比分析

/**
 * 交付物描述
 */
export interface DeliverableSpec {
    /** 交付物类型 */
    type: DeliverableType;

    /** 交付物标题 */
    title: string;

    /** 交付物描述 */
    description: string;

    /** 使用的模板 */
    template: string;

    /** 预计生成时间（分钟） */
    estimatedTime: number;

    /** 需要的质量等级 */
    requiredQuality: QualityTag;

    /** 输出格式 */
    formats: Array<"PDF" | "EXCEL" | "JSON" | "DOCX">;

    /** 包含的章节/内容 */
    includes: string[];

    /** 是否可用于外部提交（银行、政府等） */
    externalSubmission: boolean;
}

/**
 * 风险级别
 */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

/**
 * 定价层级
 */
export type PricingTier = "FREE" | "PRO" | "ENTERPRISE";

/**
 * 编排器动作
 */
export interface OrchestratorAction {
    /** 动作ID */
    id: string;

    /** 动作类型 */
    type: "RECOMMENDATION" | "REQUIRED" | "RISK_WARNING" | "UPGRADE_PROMPT";

    /** 优先级 1-10 */
    priority: number;

    // === 基本信息 ===
    /** 标题 */
    title: string;

    /** 描述 */
    description: string;

    /** 为什么推荐这个动作（证据） */
    evidence: string[];

    /** 价值说明 */
    valueProposition: string;

    // === 交付物预期 ===
    /** 交付物规格 */
    deliverable: DeliverableSpec;

    // === 风险与权限 ===
    /** 风险级别 */
    riskLevel: RiskLevel;

    /** 风险说明 */
    riskDescription?: string;

    /** 需要的权限层级 */
    requiredPermission?: PricingTier;

    /** 是否需要用户二次确认 */
    requiresConfirmation: boolean;

    /** 确认提示文本 */
    confirmationPrompt?: string;

    // === 执行路径 ===
    /** 行动号召 */
    cta: {
        label: string;
        link: string;
        icon?: string;
        preChecks?: string[]; // 执行前需确认的前置条件
    };

    // === 付费触发 ===
    /** 定价信息 */
    pricing?: {
        tier: PricingTier;
        softPaywall: boolean;  // true = 提示但可继续
        hardPaywall: boolean;  // true = 必须升级
        upgradeMessage?: string;
        estimatedValue?: string; // "可节省XX元" or "可提升XX%收益"
    };

    // === 预期结果 ===
    /** 完成后的预期成成果 */
    expectedOutcome: {
        deliverables: string[];  // 具体文件
        insights: string[];      // 获得的洞察
        nextSteps: string[];     // 解锁的下一步
    };

    /** 完成条件 */
    completionCriteria: string[];
}

/**
 * 动作生成器
 */
export class ActionGenerator {
    /**
     * 根据信号生成推荐动作
     */
    static generateActions(signals: EnhancedSignals): OrchestratorAction[] {
        const actions: OrchestratorAction[] = [];

        // 1. 基于证据完整性的动作
        if (signals.evidenceCompleteness.score < 0.8) {
            actions.push(...this.generateEvidenceActions(signals));
        }

        // 2. 基于质量升级的动作
        if (signals.needsQualityUpgrade) {
            actions.push(this.generateQualityUpgradeAction(signals));
        }

        // 3. 基于风险的动作
        if (signals.riskSignals.overallRisk !== "LOW") {
            actions.push(...this.generateRiskMitigationActions(signals));
        }

        // 4. 基于可交付性的动作
        if (signals.deliverabilityScore.score >= 0.6) {
            actions.push(...this.generateReportActions(signals));
        }

        // 5. 基于阶段的动作
        actions.push(...this.generateStageActions(signals));

        // 按优先级排序
        return actions.sort((a, b) => b.priority - a.priority);
    }

    /**
     * 生成证据收集动作
     */
    private static generateEvidenceActions(signals: EnhancedSignals): OrchestratorAction[] {
        const actions: OrchestratorAction[] = [];

        if (!signals.evidenceCompleteness.solarResource) {
            actions.push({
                id: "collect-solar-resource",
                type: "REQUIRED",
                priority: 9,
                title: "获取太阳辐照数据",
                description: "从NASA POWER获取项目地点的太阳辐照数据，这是计算发电量的核心依据",
                evidence: ["缺少太阳辐照数据", "无法进行准确的发电量计算"],
                valueProposition: "获取权威数据源，提升计算可信度",
                deliverable: {
                    type: "ANALYSIS",
                    title: "太阳资源评估报告",
                    description: "包含GHI/DNI数据和年均发电小时数",
                    template: "solar-resource-assessment",
                    estimatedTime: 2,
                    requiredQuality: "STANDARD",
                    formats: ["PDF", "JSON"],
                    includes: ["年均GHI数据", "逐月辐照曲线", "数据来源证明"],
                    externalSubmission: true
                },
                riskLevel: "LOW",
                requiresConfirmation: false,
                cta: {
                    label: "获取辐照数据",
                    link: "/api/resource/solar",
                    icon: "sun",
                    preChecks: ["确认项目地理位置准确"]
                },
                pricing: {
                    tier: "FREE",
                    softPaywall: false,
                    hardPaywall: false
                },
                expectedOutcome: {
                    deliverables: ["太阳资源评估PDF", "辐照数据JSON"],
                    insights: ["年均发电潜力", "最佳倾角建议"],
                    nextSteps: ["进行经济性分析", "生成投资报告"]
                },
                completionCriteria: ["NASA POWER数据已获取", "数据完整性>95%"]
            });
        }

        if (!signals.evidenceCompleteness.electricityPrice) {
            actions.push({
                id: "collect-electricity-price",
                type: "REQUIRED",
                priority: 8,
                title: "获取电价政策",
                description: "获取当地电价政策和补贴信息，用于收益计算",
                evidence: ["缺少电价数据", "无法计算项目收益"],
                valueProposition: "确保收益计算的准确性",
                deliverable: {
                    type: "ANALYSIS",
                    title: "电价政策摘要",
                    description: "包含峰谷平电价和补贴政策",
                    template: "electricity-price-policy",
                    estimatedTime: 5,
                    requiredQuality: "STANDARD",
                    formats: ["PDF"],
                    includes: ["政策文件号", "生效日期", "电价表"],
                    externalSubmission: true
                },
                riskLevel: "LOW",
                requiresConfirmation: false,
                cta: {
                    label: "获取电价政策",
                    link: "/project/[id]/price-policy",
                    icon: "currency",
                    preChecks: ["确认项目所在地区"]
                },
                expectedOutcome: {
                    deliverables: ["电价政策PDF"],
                    insights: ["峰谷价差分析", "补贴期限"],
                    nextSteps: ["计算投资回报率"]
                },
                completionCriteria: ["电价数据已确认", "政策文件已关联"]
            });
        }

        return actions;
    }

    /**
     * 生成质量升级动作
     */
    private static generateQualityUpgradeAction(signals: EnhancedSignals): OrchestratorAction {
        const current = signals.currentQualityTag || "PREVIEW";
        const recommended = signals.recommendedQualityTag;

        return {
            id: "upgrade-quality",
            type: "UPGRADE_PROMPT",
            priority: 7,
            title: `升级到${recommended}质量`,
            description: `当前结果为${current}级，升级到${recommended}可获得更完整的证据链和交付物`,
            evidence: signals.deliverabilityScore.blockers,
            valueProposition: recommended === "AUDIT_GRADE"
                ? "获得银行认可的审计级报告，可用于贷款申请"
                : "获得完整证据链，提升结果可信度",
            deliverable: {
                type: "REPORT",
                title: `${recommended}级项目报告`,
                description: recommended === "AUDIT_GRADE"
                    ? "包含完整证据链、不确定性分析和合规引用的审计级报告"
                    : "包含证据链的标准报告",
                template: `${recommended.toLowerCase()}-report`,
                estimatedTime: recommended === "AUDIT_GRADE" ? 10 : 5,
                requiredQuality: recommended,
                formats: ["PDF", "EXCEL"],
                includes: recommended === "AUDIT_GRADE"
                    ? ["执行摘要", "详细分析", "证据附件", "不确定性分析", "合规声明"]
                    : ["执行摘要", "详细分析", "数据来源"],
                externalSubmission: recommended === "AUDIT_GRADE"
            },
            riskLevel: "LOW",
            requiresConfirmation: false,
            cta: {
                label: "升级质量",
                link: `/project/[id]/upgrade?to=${recommended}`,
                icon: "upgrade",
                preChecks: ["确认需要更高质量的报告"]
            },
            pricing: recommended === "AUDIT_GRADE" ? {
                tier: "PRO",
                softPaywall: false,
                hardPaywall: true,
                upgradeMessage: "审计级报告需要Pro或Enterprise计划",
                estimatedValue: "可用于银行贷款申请，价值10万+"
            } : undefined,
            expectedOutcome: {
                deliverables: [`${recommended}级PDF报告`, "Excel数据表"],
                insights: recommended === "AUDIT_GRADE"
                    ? ["95%置信区间", "敏感性分析", "合规性评估"]
                    : ["完整计算依据", "数据来源追溯"],
                nextSteps: recommended === "AUDIT_GRADE"
                    ? ["提取银行", "申请贷款"]
                    : ["内部决策", "升级到审计级"]
            },
            completionCriteria: [
                "证据链完整",
                recommended === "AUDIT_GRADE" ? "不确定性已分析" : "数据来源已记录",
                "报告已生成"
            ]
        };
    }

    /**
     * 生成风险缓解动作
     */
    private static generateRiskMitigationActions(signals: EnhancedSignals): OrchestratorAction[] {
        const actions: OrchestratorAction[] = [];

        // 处理数据过时风险
        if (signals.riskSignals.dataQualityRisk !== "LOW") {
            const risk = signals.riskSignals.riskDetails.find(r => r.type === "DATA_QUALITY");
            if (risk) {
                actions.push({
                    id: "refresh-calculation",
                    type: "RISK_WARNING",
                    priority: 8,
                    title: "更新计算结果",
                    description: risk.description,
                    evidence: ["数据已过时", "可能影响决策准确性"],
                    valueProposition: "使用最新数据和口径，确保结果可靠",
                    deliverable: {
                        type: "REPORT",
                        title: "更新的投资分析报告",
                        description: "基于最新数据和口径的计算结果",
                        template: "investment-analysis",
                        estimatedTime: 3,
                        requiredQuality: signals.currentQualityTag || "STANDARD",
                        formats: ["PDF", "JSON"],
                        includes: ["更新的IRR/NPV", "最新口径版本", "变化说明"],
                        externalSubmission: true
                    },
                    riskLevel: signals.riskSignals.dataQualityRisk,
                    riskDescription: "使用过时数据可能导致投资决策失误",
                    requiresConfirmation: true,
                    confirmationPrompt: "重新计算将使用最新口径版本，结果可能与旧版本有差异。是否继续？",
                    cta: {
                        label: "重新计算",
                        link: `/project/[id]/recalculate`,
                        icon: "refresh",
                        preChecks: ["确认接受可能的结果变化"]
                    },
                    expectedOutcome: {
                        deliverables: ["最新计算报告"],
                        insights: ["与旧结果的对比", "口径变化影响"],
                        nextSteps: ["更新决策依据"]
                    },
                    completionCriteria: ["使用最新口径", "数据时效性<30天"]
                });
            }
        }

        return actions;
    }

    /**
     * 生成报告动作
     */
    private static generateReportActions(signals: EnhancedSignals): OrchestratorAction[] {
        const actions: OrchestratorAction[] = [];

        for (const deliverableType of signals.deliverabilityScore.availableDeliverables) {
            if (deliverableType === "AUDIT_REPORT") {
                actions.push({
                    id: "generate-audit-report",
                    type: "RECOMMENDATION",
                    priority: 9,
                    title: "生成审计级报告",
                    description: "生成符合银行审计要求的完整报告，可直接用于贷款申请",
                    evidence: ["证据链完整", "不确定性已分析", "合规标准已引用"],
                    valueProposition: "银行认可的专业报告，加速贷款审批",
                    deliverable: {
                        type: "REPORT",
                        title: "投资分析审计报告",
                        description: "符合银行审计要求的完整项目报告",
                        template: "audit-investment-report",
                        estimatedTime: 10,
                        requiredQuality: "AUDIT_GRADE",
                        formats: ["PDF", "EXCEL"],
                        includes: [
                            "封面页（项目信息、口径版本）",
                            "执行摘要（关键指标、风险警示）",
                            "详细分析（IRR/NPV/LCOE/现金流）",
                            "证据附件（数据来源、口径说明、中间变量）",
                            "不确定性分析（95%置信区间、敏感性分析）",
                            "合规声明（IEC/NREL标准引用）",
                            "审计元数据（哈希、可复现命令）"
                        ],
                        externalSubmission: true
                    },
                    riskLevel: "LOW",
                    requiresConfirmation: false,
                    cta: {
                        label: "生成审计报告",
                        link: `/project/[id]/report/audit`,
                        icon: "document-check",
                        preChecks: [
                            "确认所有数据已审核",
                            "确认口径版本正确"
                        ]
                    },
                    pricing: {
                        tier: "PRO",
                        softPaywall: false,
                        hardPaywall: true,
                        upgradeMessage: "审计级报告是Pro用户专享功能",
                        estimatedValue: "可用于银行贷款，加速审批流程"
                    },
                    expectedOutcome: {
                        deliverables: [
                            "审计级PDF报告（带水印、防篡改）",
                            "Excel数据表（含所有计算细节）",
                            "JSON数据文件（含证据链）"
                        ],
                        insights: [
                            "完整的投资回报分析",
                            "风险评估与敏感性分析",
                            "合规性确认"
                        ],
                        nextSteps: [
                            "提交银行申请贷款",
                            "内部投资决策会议",
                            "政府备案/审批"
                        ]
                    },
                    completionCriteria: [
                        "报告已生成",
                        "哈希验证通过",
                        "包含完整证据链",
                        "符合审计要求"
                    ]
                });
            }
        }

        return actions;
    }

    /**
     * 生成阶段特定动作
     */
    private static generateStageActions(signals: EnhancedSignals): OrchestratorAction[] {
        const actions: OrchestratorAction[] = [];

        switch (signals.stage) {
            case "PLANNING":
                if (signals.hasCalculation) {
                    actions.push({
                        id: "stage-to-design",
                        type: "RECOMMENDATION",
                        priority: 6,
                        title: "进入设计阶段",
                        description: "经济性分析已完成，可以开始详细设计",
                        evidence: ["IRR满足投资要求", "NPV为正"],
                        valueProposition: "推进项目到下一阶段",
                        deliverable: {
                            type: "TIMELINE",
                            title: "项目里程碑",
                            description: "记录项目从规划到设计的过渡",
                            template: "project-timeline",
                            estimatedTime: 1,
                            requiredQuality: "PREVIEW",
                            formats: ["JSON"],
                            includes: ["阶段变更记录", "关键决策依据"],
                            externalSubmission: false
                        },
                        riskLevel: "LOW",
                        requiresConfirmation: true,
                        confirmationPrompt: "确认进入设计阶段？这将更新项目状态。",
                        cta: {
                            label: "进入设计阶段",
                            link: `/project/[id]/stage/design`,
                            icon: "arrow-right"
                        },
                        expectedOutcome: {
                            deliverables: ["阶段变更记录"],
                            insights: [],
                            nextSteps: ["详细设计", "组件选型"]
                        },
                        completionCriteria: ["项目状态已更新"]
                    });
                }
                break;

            case "OPERATIONS":
                if (signals.hasMonitoring) {
                    actions.push({
                        id: "run-diagnosis",
                        type: "RECOMMENDATION",
                        priority: 7,
                        title: "运行诊断分析",
                        description: "基于监测数据诊断系统运行状况",
                        evidence: ["有监测数据", "可进行PR分析"],
                        valueProposition: "发现问题，减少损失",
                        deliverable: {
                            type: "DIAGNOSTIC",
                            title: "系统诊断报告",
                            description: "包含PR分析、故障诊断和优化建议",
                            template: "diagnostic-report",
                            estimatedTime: 5,
                            requiredQuality: "STANDARD",
                            formats: ["PDF"],
                            includes: ["PR趋势", "故障列表", "损失量化", "清洗建议"],
                            externalSubmission: false
                        },
                        riskLevel: "LOW",
                        requiresConfirmation: false,
                        cta: {
                            label: "运行诊断",
                            link: `/project/[id]/diagnosis`,
                            icon: "chart-line"
                        },
                        expectedOutcome: {
                            deliverables: ["诊断报告PDF"],
                            insights: ["PR分析", "发电损失", "优化方向"],
                            nextSteps: ["安排维护", "清洗组件"]
                        },
                        completionCriteria: ["诊断完成", "建议清单生成"]
                    });
                }
                break;
        }

        return actions;
    }
}

/**
 * 使用示例：
 * 
 * const signals = await EnhancedSignalGenerator.generate(projectId, userId, userPlan);
 * const actions = ActionGenerator.generateActions(signals);
 * 
 * // 展示推荐动作
 * actions.forEach(action => {
 *   console.log(`[${action.priority}] ${action.title}`);
 *   console.log(`  交付物: ${action.deliverable.title}`);
 *   console.log(`  预计: ${action.deliverable.estimatedTime}分钟`);
 *   console.log(`  价值: ${action.valueProposition}`);
 *   
 *   if (action.pricing?.hardPaywall) {
 *     console.log(`  ⚠️ 需要${action.pricing.tier}计划`);
 *   }
 * });
 */
