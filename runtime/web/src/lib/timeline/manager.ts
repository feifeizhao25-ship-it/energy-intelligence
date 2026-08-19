/**
 * 项目时间线管理器 - Project Timeline Manager
 * 
 * 自动记录项目的关键里程碑和决策过程
 * 形成完整的、可审计的项目历史
 * 
 * 核心特性：
 * 1. 自动记录关键操作（计算、诊断、阶段变更等）
 * 2. 关联证据链
 * 3. 量化影响
 * 4. 可导出审计包
 */

import { EvidenceChain } from '../kernel/evidence-chain';
import { CalculationResult } from '../kernel/calculation-result';

/**
 * 里程碑类型
 */
export type MilestoneType =
    | "PROJECT_CREATED"        // 项目创建
    | "RESOURCE_ASSESSED"      // 资源评估
    | "CALCULATION_PERFORMED"  // 财务计算
    | "DIAGNOSIS_PERFORMED"    // 诊断分析
    | "DECISION_MADE"          // 重大决策
    | "STAGE_CHANGED"          // 阶段变更
    | "REPORT_GENERATED"       // 报告生成
    | "DOCUMENT_UPLOADED"      // 文档上传
    | "OPTIMIZATION_APPLIED"   // 优化实施
    | "MILESTONE_CUSTOM";      // 自定义里程碑

/**
 * 执行者类型
 */
export type ExecutorType =
    | "USER"      // 用户手动操作
    | "AI"        // AI自动执行
    | "SYSTEM"    // 系统自动触发
    | "EXTERNAL"; // 外部集成

/**
 * 里程碑影响
 */
export interface MilestoneImpact {
    /** 影响类型 */
    type: "POSITIVE" | "NEGATIVE" | "NEUTRAL";

    /** 影响描述 */
    description: string;

    /** 量化指标（如果有） */
    quantified?: {
        metric: string;      // 指标名称如"IRR"
        before: number;      // 变化前
        after: number;       // 变化后
        delta: number;       // 变化量
        deltaPercent: number; // 变化百分比
    };
}

/**
 * 项目里程碑
 */
export interface ProjectMilestone {
    /** 里程碑ID */
    id: string;

    /** 项目ID */
    projectId: string;

    /** 里程碑类型 */
    milestoneType: MilestoneType;

    /** 标题 */
    title: string;

    /** 摘要 */
    summary: string;

    /** 关联的工件ID（计算结果、报告等） */
    artifactId?: string;

    /** 关联的证据链ID */
    evidenceChainId?: string;

    /** 交付物 */
    deliverables?: {
        type: string;
        name: string;
        url?: string;
    }[];

    /** 执行者类型 */
    executorType: ExecutorType;

    /** 执行者ID */
    executorId?: string;

    /** AI模型（如果是AI执行） */
    aiModel?: string;

    /** 使用的口径版本 */
    assumptionVersion?: string;

    /** 影响 */
    impact?: MilestoneImpact;

    /** 标签 */
    tags: string[];

    /** 创建时间 */
    createdAt: Date;
}

/**
 * 时间线导出选项
 */
export interface TimelineExportOptions {
    /** 导出格式 */
    format: "PDF" | "JSON" | "EXCEL" | "AUDIT_PACKAGE";

    /** 是否包含证据链 */
    includeEvidence: boolean;

    /** 是否包含交付物 */
    includeDeliverables: boolean;

    /** 时间范围 */
    dateRange?: {
        from: Date;
        to: Date;
    };

    /** 里程碑类型过滤 */
    milestoneTypes?: MilestoneType[];
}

/**
 * 审计包
 */
export interface AuditPackage {
    /** 包ID */
    packageId: string;

    /** 项目信息 */
    project: {
        id: string;
        name: string;
        type: string;
        createdAt: Date;
    };

    /** 时间线 */
    timeline: ProjectMilestone[];

    /** 所有证据链 */
    evidenceChains: EvidenceChain[];

    /** 所有计算结果 */
    calculations: CalculationResult[];

    /** 所有报告 */
    reports: any[];

    /** 完整性验证 */
    integrity: {
        totalMilestones: number;
        totalEvidence: number;
        allHashesValid: boolean;
        generatedAt: Date;
        packageHash: string;
    };
}

/**
 * 时间线管理器
 */
export class TimelineManager {
    /**
     * 记录里程碑
     */
    static async recordMilestone(
        projectId: string,
        milestoneType: MilestoneType,
        data: {
            title: string;
            summary: string;
            artifactId?: string;
            evidenceChainId?: string;
            deliverables?: any[];
            executorType: ExecutorType;
            executorId?: string;
            aiModel?: string;
            assumptionVersion?: string;
            impact?: MilestoneImpact;
            tags?: string[];
        }
    ): Promise<ProjectMilestone> {
        const milestone: ProjectMilestone = {
            id: `ML-${Date.now()}`,
            projectId,
            milestoneType,
            title: data.title,
            summary: data.summary,
            artifactId: data.artifactId,
            evidenceChainId: data.evidenceChainId,
            deliverables: data.deliverables,
            executorType: data.executorType,
            executorId: data.executorId,
            aiModel: data.aiModel,
            assumptionVersion: data.assumptionVersion,
            impact: data.impact,
            tags: data.tags || [],
            createdAt: new Date()
        };

        // TODO: 保存到数据库
        // await prisma.projectTimeline.create({ data: milestone });

        return milestone;
    }

    /**
     * 自动记录计算里程碑
     */
    static async recordCalculation(
        projectId: string,
        calculationResult: CalculationResult,
        previousResult?: CalculationResult,
        userId?: string
    ): Promise<ProjectMilestone> {
        const data = calculationResult.result;
        const auditMeta = calculationResult.auditMeta;

        // 计算影响（如果有上一次结果）
        let impact: MilestoneImpact | undefined;
        if (previousResult) {
            const prevIRR = previousResult.result.irr;
            const currIRR = data.irr;
            const delta = currIRR - prevIRR;
            const deltaPercent = (delta / prevIRR) * 100;

            impact = {
                type: delta > 0 ? "POSITIVE" : (delta < 0 ? "NEGATIVE" : "NEUTRAL"),
                description: delta > 0
                    ? `IRR提升了${deltaPercent.toFixed(2)}%`
                    : (delta < 0 ? `IRR下降了${Math.abs(deltaPercent).toFixed(2)}%` : "IRR无变化"),
                quantified: {
                    metric: "IRR",
                    before: prevIRR,
                    after: currIRR,
                    delta,
                    deltaPercent
                }
            };
        }

        return this.recordMilestone(projectId, "CALCULATION_PERFORMED", {
            title: "完成财务计算",
            summary: `IRR=${data.irr.toFixed(2)}%, NPV=${(data.npv / 10000).toFixed(2)}万元, 回收期=${data.paybackPeriod.toFixed(1)}年`,
            artifactId: auditMeta.id,
            evidenceChainId: calculationResult.evidence.conclusionId,
            deliverables: [
                {
                    type: "CALCULATION_RESULT",
                    name: "财务计算结果",
                    url: `/api/calculations/${auditMeta.id}`
                }
            ],
            executorType: userId ? "USER" : "SYSTEM",
            executorId: userId,
            assumptionVersion: auditMeta.assumptionVersion,
            impact,
            tags: ["财务分析", auditMeta.qualityTag]
        });
    }

    /**
     * 自动记录报告生成里程碑
     */
    static async recordReportGeneration(
        projectId: string,
        reportId: string,
        reportType: string,
        qualityTag: string,
        userId?: string
    ): Promise<ProjectMilestone> {
        return this.recordMilestone(projectId, "REPORT_GENERATED", {
            title: `生成${qualityTag}级报告`,
            summary: `已生成${reportType}报告，可用于对外提交`,
            artifactId: reportId,
            deliverables: [
                {
                    type: "REPORT",
                    name: `${reportType}报告`,
                    url: `/api/reports/${reportId}/pdf`
                }
            ],
            executorType: userId ? "USER" : "SYSTEM",
            executorId: userId,
            tags: ["报告", qualityTag, reportType]
        });
    }

    /**
     * 记录阶段变更
     */
    static async recordStageChange(
        projectId: string,
        fromStage: string,
        toStage: string,
        reason: string,
        userId?: string
    ): Promise<ProjectMilestone> {
        return this.recordMilestone(projectId, "STAGE_CHANGED", {
            title: `项目阶段变更：${fromStage} → ${toStage}`,
            summary: reason,
            executorType: userId ? "USER" : "SYSTEM",
            executorId: userId,
            impact: {
                type: "POSITIVE",
                description: `项目推进到${toStage}阶段`
            },
            tags: ["阶段变更", fromStage, toStage]
        });
    }

    /**
     * 记录重大决策
     */
    static async recordDecision(
        projectId: string,
        decision: {
            title: string;
            description: string;
            rationale: string;
            evidenceId?: string;
        },
        userId: string
    ): Promise<ProjectMilestone> {
        return this.recordMilestone(projectId, "DECISION_MADE", {
            title: decision.title,
            summary: `${decision.description}\n理由：${decision.rationale}`,
            evidenceChainId: decision.evidenceId,
            executorType: "USER",
            executorId: userId,
            tags: ["决策", "重要"]
        });
    }

    /**
     * 获取项目时间线
     */
    static async getTimeline(
        projectId: string,
        options?: {
            limit?: number;
            offset?: number;
            types?: MilestoneType[];
            fromDate?: Date;
            toDate?: Date;
        }
    ): Promise<ProjectMilestone[]> {
        // TODO: 从数据库查询
        // return prisma.projectTimeline.findMany({
        //   where: {
        //     projectId,
        //     milestoneType: { in: options?.types },
        //     createdAt: {
        //       gte: options?.fromDate,
        //       lte: options?.toDate
        //     }
        //   },
        //   orderBy: { createdAt: 'desc' },
        //   take: options?.limit,
        //   skip: options?.offset
        // });

        return [];
    }

    /**
     * 导出时间线
     */
    static async exportTimeline(
        projectId: string,
        options: TimelineExportOptions
    ): Promise<string | AuditPackage> {
        const timeline = await this.getTimeline(projectId, {
            types: options.milestoneTypes,
            fromDate: options.dateRange?.from,
            toDate: options.dateRange?.to
        });

        if (options.format === "AUDIT_PACKAGE") {
            return this.generateAuditPackage(projectId, timeline, options);
        }

        // TODO: 生成其他格式
        return `/exports/${projectId}/timeline.${options.format.toLowerCase()}`;
    }

    /**
     * 生成审计包
     */
    private static async generateAuditPackage(
        projectId: string,
        timeline: ProjectMilestone[],
        options: TimelineExportOptions
    ): Promise<AuditPackage> {
        // 收集所有关联的证据链
        const evidenceChainIds = timeline
            .map(m => m.evidenceChainId)
            .filter(Boolean) as string[];

        // TODO: 从数据库查询
        const evidenceChains: EvidenceChain[] = [];
        const calculations: CalculationResult[] = [];
        const reports: any[] = [];

        // 验证哈希完整性
        const allHashesValid = calculations.every(calc => {
            // TODO: 实际验证哈希
            return true;
        });

        const packageData = {
            timeline,
            evidenceChains,
            calculations,
            reports
        };

        // 生成包哈希
        const packageHash = this.hashObject(packageData);

        return {
            packageId: `AUDIT-${projectId}-${Date.now()}`,
            project: {
                id: projectId,
                name: "项目名称", // TODO: 从数据库获取
                type: "SOLAR",
                createdAt: new Date()
            },
            timeline,
            evidenceChains,
            calculations,
            reports,
            integrity: {
                totalMilestones: timeline.length,
                totalEvidence: evidenceChains.length,
                allHashesValid,
                generatedAt: new Date(),
                packageHash
            }
        };
    }

    /**
     * 生成对象哈希
     */
    private static hashObject(obj: any): string {
        // TODO: 实际使用crypto生成SHA256
        return `PKG-${Date.now()}`;
    }

    /**
     * 获取时间线统计
     */
    static async getTimelineStats(projectId: string): Promise<{
        totalMilestones: number;
        milestonesByType: Record<MilestoneType, number>;
        firstMilestone?: Date;
        lastMilestone?: Date;
        averageFrequency: number; // 平均多少天一个里程碑
    }> {
        const timeline = await this.getTimeline(projectId);

        const milestonesByType = timeline.reduce((acc, m) => {
            acc[m.milestoneType] = (acc[m.milestoneType] || 0) + 1;
            return acc;
        }, {} as Record<MilestoneType, number>);

        const dates = timeline.map(m => m.createdAt.getTime());
        const firstMilestone = dates.length > 0 ? new Date(Math.min(...dates)) : undefined;
        const lastMilestone = dates.length > 0 ? new Date(Math.max(...dates)) : undefined;

        let averageFrequency = 0;
        if (firstMilestone && lastMilestone && timeline.length > 1) {
            const daysDiff = (lastMilestone.getTime() - firstMilestone.getTime()) / (1000 * 60 * 60 * 24);
            averageFrequency = daysDiff / (timeline.length - 1);
        }

        return {
            totalMilestones: timeline.length,
            milestonesByType,
            firstMilestone,
            lastMilestone,
            averageFrequency
        };
    }
}

/**
 * 使用示例：
 * 
 * // 1. 记录计算
 * await TimelineManager.recordCalculation(
 *   projectId,
 *   calculationResult,
 *   previousResult,
 *   userId
 * );
 * 
 * // 2. 记录阶段变更
 * await TimelineManager.recordStageChange(
 *   projectId,
 *   "PLANNING",
 *   "DESIGN",
 *   "投资分析通过，进入设计阶段",
 *   userId
 * );
 * 
 * // 3. 记录重大决策
 * await TimelineManager.recordDecision(
 *   projectId,
 *   {
 *     title: "确定采用XXX品牌组件",
 *     description: "经过技术评估和商务谈判",
 *     rationale: "性价比最优，且有5年质保",
 *     evidenceId: "evidence-xxx"
 *   },
 *   userId
 * );
 * 
 * // 4. 获取时间线
 * const timeline = await TimelineManager.getTimeline(projectId, {
 *   limit: 20,
 *   types: ["CALCULATION_PERFORMED", "DECISION_MADE"]
 * });
 * 
 * // 5. 导出审计包
 * const auditPackage = await TimelineManager.exportTimeline(projectId, {
 *   format: "AUDIT_PACKAGE",
 *   includeEvidence: true,
 *   includeDeliverables: true
 * });
 * 
 * console.log(`审计包包含 ${auditPackage.timeline.length} 个里程碑`);
 * console.log(`哈希校验: ${auditPackage.integrity.allHashesValid ? '通过' : '失败'}`);
 */
