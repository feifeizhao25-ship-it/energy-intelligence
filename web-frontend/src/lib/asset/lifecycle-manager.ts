/**
 * 资产生命周期管理系统 - Asset Lifecycle Manager
 * 
 * **这是0→1亿的核心功能！**
 * 
 * 从"算一次"到"长期托管"的关键跃迁
 * 让项目在系统里"活着"，而不是用完即走
 * 
 * 核心价值：
 * 1. 用户粘性：从<1天 → >30天
 * 2. 付费转化：从一次性 → 持续订阅
 * 3. 资产沉淀：从0 → 每日累积
 * 4. 迁移成本：从0 → ∞
 */

import { TimelineManager, ProjectMilestone } from '../timeline/manager';
import { CalculationResult } from '../kernel/calculation-result';

/**
 * 项目生命周期阶段
 */
export type ProjectLifecycleStage =
    | "PLANNING"        // 规划阶段：可研、选址
    | "DESIGN"          // 设计阶段：详细设计
    | "FINANCING"       // 融资阶段：银行贷款
    | "CONSTRUCTION"    // 建设阶段：施工中
    | "COMMISSIONING"   // 调试阶段：并网测试
    | "OPERATING"       // 运行阶段：正常发电
    | "OPTIMIZATION"    // 优化阶段：性能提升
    | "DECOMMISSIONING"; // 退役阶段

/**
 * 项目激活状态
 */
export type ActivationStatus =
    | "INACTIVE"      // 未激活：只算过一次
    | "ACTIVATING"    // 激活中：配置数据源
    | "ACTIVE"        // 已激活：长期监测
    | "SUSPENDED"     // 挂起：暂停监测
    | "ARCHIVED";     // 归档：项目结束

/**
 * 数据源连接配置
 */
export interface DataSourceConnections {
    /** 逆变器数据源 */
    inverter?: {
        type: "HUAWEI" | "SUNGROW" | "SMA" | "CUSTOM";
        endpoint: string;
        credentials: {
            apiKey?: string;
            username?: string;
            password?: string;
        };
        pollInterval: number; // 轮询间隔（分钟）
    };

    /** 电表数据源 */
    meter?: {
        type: "MODBUS" | "MQTT" | "HTTP_API";
        endpoint: string;
        protocol?: any;
    };

    /** 气象数据源 */
    weather?: {
        provider: "OPEN_METEO" | "WEATHER_API" | "CUSTOM";
        location: { lat: number; lng: number };
    };

    /** 电网数据 */
    grid?: {
        provider: string;
        endpoint?: string;
    };
}

/**
 * 自动化任务配置
 */
export interface AutomationConfig {
    /** 每日PR计算 */
    dailyPRCalculation: boolean;

    /** 月度收益报告 */
    monthlyRevenueReport: boolean;

    /** 异常检测 */
    anomalyDetection: {
        enabled: boolean;
        thresholds: {
            prDropThreshold: number;      // PR下降阈值 (如0.8)
            generationDropThreshold: number; // 发电量下降阈值 (如0.7)
            faultCountThreshold: number;  // 故障次数阈值
        };
    };

    /** 性能告警 */
    performanceAlert: {
        enabled: boolean;
        recipients: string[]; // 邮箱/手机号
        alertChannels: ("EMAIL" | "SMS" | "WEBHOOK")[];
    };

    /** 运维建议 */
    maintenanceAdvisor: {
        enabled: boolean;
        frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    };
}

/**
 * 资产健康度
 */
export interface AssetHealth {
    /** 整体健康评分 0-100 */
    overallScore: number;

    /** 评分时间 */
    assessedAt: Date;

    /** 各维度评分 */
    dimensions: {
        /** 性能维度 */
        performance: {
            score: number;
            pr: number;              // 当前PR
            prTrend: "UP" | "DOWN" | "STABLE";
            generationRate: number;   // 发电达成率
            issues: string[];
        };

        /** 可靠性维度 */
        reliability: {
            score: number;
            faultRate: number;       // 故障率 (次/月)
            mtbf: number;            // 平均故障间隔时间 (小时)
            availabilityRate: number; // 可用率
        };

        /** 财务健康度 */
        financialHealth: {
            score: number;
            actualVsExpectedRevenue: number; // 实际/预期收益比
            cashFlowStatus: "HEALTHY" | "WARNING" | "CRITICAL";
            deviationFromIRR: number; // 与预测IRR偏差
        };

        /** 合规性 */
        compliance: {
            score: number;
            regulatoryStatus: "COMPLIANT" | "WARNING" | "VIOLATION";
            certifications: string[];
            expiringCertificates: Array<{
                name: string;
                expiresAt: Date;
                daysRemaining: number;
            }>;
        };
    };

    /** 投资等级（对标穆迪/标普） */
    investmentGrade: "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C" | "D";

    /** 等级理由 */
    gradeRationale: string;

    /** 改进建议 */
    improvementActions: Array<{
        action: string;
        expectedImpact: string;
        estimatedCost: number;
        roi: string;
    }>;
}

/**
 * 激活的项目
 */
export interface ActivatedProject {
    /** 项目ID */
    projectId: string;

    /** 激活状态 */
    activationStatus: ActivationStatus;

    /** 当前生命周期阶段 */
    currentStage: ProjectLifecycleStage;

    /** 激活时间 */
    activatedAt: Date;

    /** 数据源连接 */
    dataConnections: DataSourceConnections;

    /** 自动化配置 */
    automation: AutomationConfig;

    /** 最新健康度 */
    latestHealth?: AssetHealth;

    /** 监测统计 */
    monitoringStats: {
        totalDaysMonitored: number;
        dataPointsCollected: number;
        anomaliesDetected: number;
        alertsSent: number;
        reportsGenerated: number;
    };
}

/**
 * 资产生命周期管理器
 */
export class AssetLifecycleManager {
    /**
     * 激活项目（核心功能！）
     * 
     * 将项目从"算一次"升级为"长期托管"
     */
    static async activateProject(
        projectId: string,
        config: {
            dataConnections: DataSourceConnections;
            automation: AutomationConfig;
            initialStage: ProjectLifecycleStage;
        },
        userId: string
    ): Promise<ActivatedProject> {
        console.log(`[激活项目] ${projectId} - 从"算一次"→"长期托管"`);

        // 1. 验证数据源连接
        await this.validateDataConnections(config.dataConnections);

        // 2. 建立数据采集任务
        await this.setupDataCollection(projectId, config.dataConnections);

        // 3. 启动自动化任务
        await this.startAutomationTasks(projectId, config.automation);

        // 4. 建立性能基线
        await this.establishBaseline(projectId);

        // 5. 记录时间线
        await TimelineManager.recordMilestone(projectId, "PROJECT_CREATED", {
            title: "项目激活",
            summary: "项目已激活长期监测，开始资产托管",
            executorType: "USER",
            executorId: userId,
            deliverables: [{
                type: "ASSET_ACTIVATION",
                name: "长期监测服务已启动"
            }],
            tags: ["激活", "资产托管"]
        });

        const activated: ActivatedProject = {
            projectId,
            activationStatus: "ACTIVE",
            currentStage: config.initialStage,
            activatedAt: new Date(),
            dataConnections: config.dataConnections,
            automation: config.automation,
            monitoringStats: {
                totalDaysMonitored: 0,
                dataPointsCollected: 0,
                anomaliesDetected: 0,
                alertsSent: 0,
                reportsGenerated: 0
            }
        };

        // TODO: 保存到数据库
        // await prisma.activatedProject.create({ data: activated });

        console.log(`[✅ 项目激活成功] ${projectId} - 用户将每天回来查看数据`);

        return activated;
    }

    /**
     * 每日自动分析（核心功能！）
     * 
     * 这是用户"每天回来"的原因
     */
    static async performDailyAnalysis(projectId: string): Promise<{
        date: Date;
        generation: {
            actual: number;
            expected: number;
            ratio: number;
        };
        pr: number;
        revenue: {
            actual: number;
            expected: number;
            deviation: number;
        };
        anomalies: Array<{
            type: string;
            severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
            description: string;
            recommendation: string;
        }>;
        healthScore: number;
        trend: "IMPROVING" | "STABLE" | "DEGRADING";
    }> {
        console.log(`[每日分析] ${projectId} - ${new Date().toDateString()}`);

        // 1. 获取今日发电量
        const todayGeneration = await this.getTodayGeneration(projectId);

        // 2. 计算理论发电量
        const expectedGeneration = await this.getExpectedGeneration(projectId, new Date());

        // 3. 计算PR
        const pr = todayGeneration / expectedGeneration;

        // 4. 计算收益
        const electricityPrice = await this.getElectricityPrice(projectId);
        const actualRevenue = todayGeneration * electricityPrice;
        const expectedRevenue = expectedGeneration * electricityPrice;

        // 5. 异常检测
        const anomalies = await this.detectAnomalies(projectId, {
            pr,
            generationRatio: todayGeneration / expectedGeneration,
            faultCount: await this.getTodayFaultCount(projectId)
        });

        // 6. 健康度评估
        const healthScore = await this.calculateHealthScore(projectId);

        // 7. 趋势判断
        const trend = await this.assessTrend(projectId, healthScore);

        // 8. 记录时间线
        await TimelineManager.recordMilestone(projectId, "CALCULATION_PERFORMED", {
            title: "每日性能分析",
            summary: `发电${todayGeneration.toFixed(0)}kWh (${(pr * 100).toFixed(1)}%), 收益¥${actualRevenue.toFixed(2)}`,
            executorType: "SYSTEM",
            impact: pr < 0.8 ? {
                type: "NEGATIVE",
                description: `PR仅${(pr * 100).toFixed(1)}%，低于标准`,
                quantified: {
                    metric: "PR",
                    before: 0.85,
                    after: pr,
                    delta: pr - 0.85,
                    deltaPercent: ((pr - 0.85) / 0.85) * 100
                }
            } : undefined,
            tags: ["每日分析", pr < 0.8 ? "性能告警" : "正常"]
        });

        // 9. 发送告警（如有）
        if (anomalies.some(a => a.severity === "HIGH" || a.severity === "CRITICAL")) {
            await this.sendAlert(projectId, anomalies);
        }

        return {
            date: new Date(),
            generation: {
                actual: todayGeneration,
                expected: expectedGeneration,
                ratio: todayGeneration / expectedGeneration
            },
            pr,
            revenue: {
                actual: actualRevenue,
                expected: expectedRevenue,
                deviation: actualRevenue - expectedRevenue
            },
            anomalies,
            healthScore,
            trend
        };
    }

    /**
     * 计算资产健康度（对接资本市场的关键！）
     */
    static async assessAssetHealth(projectId: string): Promise<AssetHealth> {
        // 获取历史数据
        const history = await this.getPerformanceHistory(projectId, 90); // 90天

        // 1. 性能评分
        const performanceScore = this.calculatePerformanceScore(history);

        // 2. 可靠性评分
        const reliabilityScore = await this.calculateReliabilityScore(projectId);

        // 3. 财务健康度
        const financialScore = await this.calculateFinancialHealthScore(projectId);

        // 4. 合规性评分
        const complianceScore = await this.calculateComplianceScore(projectId);

        // 5. 综合评分 (加权平均)
        const overallScore =
            performanceScore.score * 0.35 +
            reliabilityScore.score * 0.25 +
            financialScore.score * 0.30 +
            complianceScore.score * 0.10;

        // 6. 确定投资等级
        const investmentGrade = this.determineInvestmentGrade(overallScore, {
            performance: performanceScore.score,
            reliability: reliabilityScore.score,
            financial: financialScore.score
        });

        return {
            overallScore,
            assessedAt: new Date(),
            dimensions: {
                performance: performanceScore,
                reliability: reliabilityScore,
                financialHealth: financialScore,
                compliance: complianceScore
            },
            investmentGrade,
            gradeRationale: this.generateGradeRationale(overallScore, investmentGrade),
            improvementActions: await this.generateImprovementActions(projectId, {
                performance: performanceScore,
                reliability: reliabilityScore,
                financial: financialScore
            })
        };
    }

    /**
     * 确定投资等级（对标穆迪/标普）
     */
    private static determineInvestmentGrade(
        overallScore: number,
        dimensions: { performance: number; reliability: number; financial: number }
    ): AssetHealth['investmentGrade'] {
        // 综合评分 + 各维度平衡性
        const minDimensionScore = Math.min(
            dimensions.performance,
            dimensions.reliability,
            dimensions.financial
        );

        // 投资级（Investment Grade）: BBB及以上
        if (overallScore >= 90 && minDimensionScore >= 85) {
            return "AAA"; // 最高等级：几乎无风险
        } else if (overallScore >= 85 && minDimensionScore >= 80) {
            return "AA";  // 优质资产：风险极低
        } else if (overallScore >= 80 && minDimensionScore >= 75) {
            return "A";   // 高质量：风险低
        } else if (overallScore >= 70 && minDimensionScore >= 65) {
            return "BBB"; // 合格投资级：中等风险
        }

        // 投机级（Speculative Grade）: BB及以下
        else if (overallScore >= 60) {
            return "BB";  // 投机级：较高风险
        } else if (overallScore >= 50) {
            return "B";   // 高风险
        } else if (overallScore >= 40) {
            return "C";   // 极高风险
        } else {
            return "D";   // 违约/破产风险
        }
    }

    /**
     * 生成自动化运维建议
     */
    static async generateWeeklyMaintenancePlan(projectId: string): Promise<Array<{
        priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
        action: string;
        reason: string;
        estimatedCost: number;
        estimatedGain: number;
        roi: string;
        recommendedDate: Date;
    }>> {
        const health = await this.assessAssetHealth(projectId);
        const weather = await this.getWeatherForecast(projectId, 7); // 7天预报

        const plan = [];

        // 基于性能下降
        if (health.dimensions.performance.pr < 0.80) {
            const dailyLoss = await this.calculateDailyLossFromPR(
                projectId,
                0.80 - health.dimensions.performance.pr
            );

            plan.push({
                priority: "HIGH",
                action: "组件清洗",
                reason: `PR已降至${(health.dimensions.performance.pr * 100).toFixed(1)}%，低于标准80%`,
                estimatedCost: 2000,
                estimatedGain: dailyLoss * 10, // 清洗后10天收益
                roi: "5天回本",
                recommendedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2天后
            });
        }

        // 基于天气预测
        if (weather.some(d => d.hasDustStorm)) {
            plan.push({
                priority: "MEDIUM",
                action: "沙尘暴防护",
                reason: "预计3天后有沙尘暴",
                estimatedCost: 500,
                estimatedGain: 5000, // 避免设备损坏
                roi: "预防性维护",
                recommendedDate: weather.find(d => d.hasDustStorm)!.date
            });
        }

        // 基于故障预测
        const faultPrediction = await this.predictFaults(projectId);
        if (faultPrediction.inverterFailureRisk > 0.7) {
            plan.push({
                priority: "CRITICAL",
                action: "逆变器巡检",
                reason: `逆变器故障风险${(faultPrediction.inverterFailureRisk * 100).toFixed(0)}%`,
                estimatedCost: 1000,
                estimatedGain: 50000, // 避免长时间停机
                roi: "立即执行",
                recommendedDate: new Date()
            });
        }

        return plan.sort((a, b) => {
            const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    // ==================== 辅助方法 ====================

    private static async validateDataConnections(connections: DataSourceConnections): Promise<void> {
        // TODO: 实际验证数据源连接
    }

    private static async setupDataCollection(projectId: string, connections: DataSourceConnections): Promise<void> {
        // TODO: 设置定时任务采集数据
    }

    private static async startAutomationTasks(projectId: string, config: AutomationConfig): Promise<void> {
        // TODO: 启动自动化任务
    }

    private static async establishBaseline(projectId: string): Promise<void> {
        // TODO: 建立性能基线
    }

    private static async getTodayGeneration(projectId: string): Promise<number> {
        // TODO: 从数据源获取今日发电量
        return 1200; // 示例
    }

    private static async getExpectedGeneration(projectId: string, date: Date): Promise<number> {
        // TODO: 基于辐照数据计算理论发电量
        return 1400; // 示例
    }

    private static async getElectricityPrice(projectId: string): Promise<number> {
        // TODO: 获取电价
        return 0.45; // 示例
    }

    private static async getTodayFaultCount(projectId: string): Promise<number> {
        // TODO: 获取今日故障次数
        return 0;
    }

    private static async detectAnomalies(
        projectId: string,
        metrics: { pr: number; generationRatio: number; faultCount: number }
    ): Promise<Array<any>> {
        const anomalies = [];

        if (metrics.pr < 0.75) {
            anomalies.push({
                type: "LOW_PR",
                severity: "HIGH",
                description: `PR仅${(metrics.pr * 100).toFixed(1)}%，可能存在组件污损或设备故障`,
                recommendation: "建议进行现场巡检，检查组件清洁度和逆变器状态"
            });
        }

        if (metrics.faultCount > 3) {
            anomalies.push({
                type: "FREQUENT_FAULTS",
                severity: "CRITICAL",
                description: `今日故障${metrics.faultCount}次，远超正常水平`,
                recommendation: "立即安排技术人员现场诊断"
            });
        }

        return anomalies;
    }

    private static async calculateHealthScore(projectId: string): Promise<number> {
        // TODO: 实际计算健康度
        return 85;
    }

    private static async assessTrend(projectId: string, currentScore: number): Promise<"IMPROVING" | "STABLE" | "DEGRADING"> {
        // TODO: 分析趋势
        return "STABLE";
    }

    private static async sendAlert(projectId: string, anomalies: any[]): Promise<void> {
        // TODO: 发送告警
        console.log(`[告警] 项目${projectId}检测到${anomalies.length}个异常`);
    }

    private static async getPerformanceHistory(projectId: string, days: number): Promise<any> {
        // TODO: 获取历史性能数据
        return {};
    }

    private static calculatePerformanceScore(history: any): any {
        // TODO: 计算性能评分
        return {
            score: 85,
            pr: 0.82,
            prTrend: "STABLE",
            generationRate: 0.95,
            issues: []
        };
    }

    private static async calculateReliabilityScore(projectId: string): Promise<any> {
        return {
            score: 90,
            faultRate: 0.5,
            mtbf: 720,
            availabilityRate: 0.998
        };
    }

    private static async calculateFinancialHealthScore(projectId: string): Promise<any> {
        return {
            score: 88,
            actualVsExpectedRevenue: 1.02,
            cashFlowStatus: "HEALTHY",
            deviationFromIRR: 0.5
        };
    }

    private static async calculateComplianceScore(projectId: string): Promise<any> {
        return {
            score: 95,
            regulatoryStatus: "COMPLIANT",
            certifications: ["ISO9001", "IEC61724"],
            expiringCertificates: []
        };
    }

    private static generateGradeRationale(score: number, grade: string): string {
        return `综合评分${score.toFixed(1)}，等级${grade}。资产表现${score >= 80 ? '优秀' : score >= 70 ? '良好' : '需改进'}，符合投资标准。`;
    }

    private static async generateImprovementActions(projectId: string, dimensions: any): Promise<any[]> {
        return [];
    }

    private static async getWeatherForecast(projectId: string, days: number): Promise<any[]> {
        return [];
    }

    private static async calculateDailyLossFromPR(projectId: string, prDrop: number): Promise<number> {
        return 500; // 示例
    }

    private static async predictFaults(projectId: string): Promise<any> {
        return { inverterFailureRisk: 0.3 };
    }
}

/**
 * 使用示例：
 * 
 * // 1. 激活项目
 * const activated = await AssetLifecycleManager.activateProject(
 *   'proj-001',
 *   {
 *     dataConnections: {
 *       inverter: {
 *         type: "HUAWEI",
 *         endpoint: "https://api.huawei.com/...",
 *         credentials: { apiKey: "..." },
 *         pollInterval: 15
 *       },
 *       weather: {
 *         provider: "OPEN_METEO",
 *         location: { lat: 39.9, lng: 116.4 }
 *       }
 *     },
 *     automation: {
 *       dailyPRCalculation: true,
 *       monthlyRevenueReport: true,
 *       anomalyDetection: {
 *         enabled: true,
 *         thresholds: {
 *           prDropThreshold: 0.8,
 *           generationDropThreshold: 0.7,
 *           faultCountThreshold: 3
 *         }
 *       },
 *       performanceAlert: {
 *         enabled: true,
 *        recipients: ["manager@example.com"],
 *         alertChannels: ["EMAIL", "SMS"]
 *       },
 *       maintenanceAdvisor: {
 *         enabled: true,
 *         frequency: "WEEKLY"
 *       }
 *     },
 *     initialStage: "OPERATING"
 *   },
 *   'user-123'
 * );
 * 
 * // 2. 每日自动分析（定时任务）
 * const dailyReport = await AssetLifecycleManager.performDailyAnalysis('proj-001');
 * console.log(`今日PR: ${(dailyReport.pr * 100).toFixed(1)}%`);
 * console.log(`收益: ¥${dailyReport.revenue.actual.toFixed(2)}`);
 * 
 * // 3. 评估资产健康度
 * const health = await AssetLifecycleManager.assessAssetHealth('proj-001');
 * console.log(`健康评分: ${health.overallScore.toFixed(1)}`);
 * console.log(`投资等级: ${health.investmentGrade}`);
 * 
 * // 4. 生成运维计划
 * const plan = await AssetLifecycleManager.generateWeeklyMaintenancePlan('proj-001');
 * plan.forEach(task => {
 *   console.log(`[${task.priority}] ${task.action} - ROI: ${task.roi}`);
 * });
 */
