/**
 * 口径与假设版本管理系统
 * 
 * 核心思想：像"会计准则"一样管理计算口径
 * - 同一版本保证结果可比
 * - 版本变更可追溯
 * - 基于行业标准（IEC、NREL等）
 */

export interface AssumptionVersion {
    /** 版本ID，如 "v2024.1" */
    id: string;

    /** 版本名称 */
    name: string;

    /** 生效日期 */
    effectiveDate: Date;

    /** 标准口径定义 */
    standards: {
        /** PR计算口径 */
        prCalculation: {
            formula: string;
            excludeConditions: string[];
            referenceStandard: string;
        };

        /** LCOE计算口径 */
        lcoeCalculation: {
            discountRate: number;
            systemLifetime: number;
            degradationRate: number;
            referenceStandard: string;
        };

        /** IRR计算口径 */
        irrCalculation: {
            taxRate: number;
            constructionPeriod: number;
            operationPeriod: number;
            referenceStandard: string;
        };

        /** 储能套利口径 */
        storageArbitrage: {
            roundTripEfficiency: number;
            cycleLifetime: number;
            peakValleyDelta: number;
            degradationRate: number;
        };

        /** 诊断口径 */
        diagnostics: {
            prThreshold: {
                excellent: number;
                good: number;
                fair: number;
                poor: number;
            };
            dustLossThreshold: number;
            shadingLossThreshold: number;
        };
    };

    /** 版本变更说明 */
    changelog: string;

    /** 是否已废弃 */
    deprecated: boolean;

    /** 创建时间 */
    createdAt: Date;
}

/**
 * 当前生效的标准版本 v2024.1
 */
export const CURRENT_ASSUMPTION_VERSION: AssumptionVersion = {
    id: "v2024.1",
    name: "2024年标准口径",
    effectiveDate: new Date("2024-01-01"),

    standards: {
        prCalculation: {
            formula: "PR = (实际发电量 / 理论发电量) × 100%",
            excludeConditions: [
                "辐照度 < 100 W/m²",
                "系统故障期间",
                "电网限电期间",
                "极端天气（台风、暴雪）"
            ],
            referenceStandard: "IEC 61724-1:2017"
        },

        lcoeCalculation: {
            discountRate: 0.08,        // 8% 折现率
            systemLifetime: 25,         // 25年系统寿命
            degradationRate: 0.005,     // 0.5%/年 衰减率
            referenceStandard: "NREL ATB 2023"
        },

        irrCalculation: {
            taxRate: 0.25,             // 25% 企业所得税
            constructionPeriod: 1,      // 1年建设期
            operationPeriod: 25,        // 25年运营期
            referenceStandard: "国家发改委投资项目评估方法"
        },

        storageArbitrage: {
            roundTripEfficiency: 0.90,  // 90% 充放电效率
            cycleLifetime: 6000,        // 6000次循环寿命
            peakValleyDelta: 0.5,       // 最小峰谷价差 0.5元/kWh
            degradationRate: 0.02       // 2%/年 容量衰减
        },

        diagnostics: {
            prThreshold: {
                excellent: 0.85,        // >85% 优秀
                good: 0.75,            // 75-85% 良好
                fair: 0.65,            // 65-75% 一般
                poor: 0.65             // <65% 较差
            },
            dustLossThreshold: 0.05,    // 5% 灰尘损失阈值
            shadingLossThreshold: 0.03  // 3% 阴影损失阈值
        }
    },

    changelog: "初始标准版本，基于IEC 61724-1:2017、NREL ATB 2023等行业标准制定",
    deprecated: false,
    createdAt: new Date("2024-01-01")
};

/**
 * 历史版本（用于版本对比和升级影响分析）
 */
export const ASSUMPTION_VERSIONS: AssumptionVersion[] = [
    CURRENT_ASSUMPTION_VERSION,

    // 未来可以添加新版本，如：
    // {
    //   id: "v2025.1",
    //   name: "2025年更新口径",
    //   ...
    //   changelog: "更新储能循环寿命至8000次，基于最新电池技术进展"
    // }
];

/**
 * 版本比较结果
 */
export interface VersionComparisonResult {
    versionA: string;
    versionB: string;
    differences: Array<{
        path: string;
        oldValue: any;
        newValue: any;
        impact: "HIGH" | "MEDIUM" | "LOW";
        description: string;
    }>;
    compatibilityScore: number; // 0-1，兼容性评分
}

/**
 * 口径管理器
 */
export class AssumptionManager {
    /**
     * 获取当前生效版本
     */
    static getCurrentVersion(): AssumptionVersion {
        return CURRENT_ASSUMPTION_VERSION;
    }

    /**
     * 获取指定版本
     */
    static getVersion(versionId: string): AssumptionVersion | null {
        return ASSUMPTION_VERSIONS.find(v => v.id === versionId) || null;
    }

    /**
     * 获取所有版本
     */
    static getAllVersions(): AssumptionVersion[] {
        return ASSUMPTION_VERSIONS;
    }

    /**
     * 比较两个版本的差异
     */
    static compareVersions(
        versionIdA: string,
        versionIdB: string
    ): VersionComparisonResult {
        const versionA = this.getVersion(versionIdA);
        const versionB = this.getVersion(versionIdB);

        if (!versionA || !versionB) {
            throw new Error("Invalid version ID");
        }

        const differences = [];

        // 比较LCOE口径
        if (versionA.standards.lcoeCalculation.discountRate !==
            versionB.standards.lcoeCalculation.discountRate) {
            differences.push({
                path: "standards.lcoeCalculation.discountRate",
                oldValue: versionA.standards.lcoeCalculation.discountRate,
                newValue: versionB.standards.lcoeCalculation.discountRate,
                impact: "HIGH" as const,
                description: "折现率变更将显著影响LCOE和NPV计算结果"
            });
        }

        // 比较衰减率
        if (versionA.standards.lcoeCalculation.degradationRate !==
            versionB.standards.lcoeCalculation.degradationRate) {
            differences.push({
                path: "standards.lcoeCalculation.degradationRate",
                oldValue: versionA.standards.lcoeCalculation.degradationRate,
                newValue: versionB.standards.lcoeCalculation.degradationRate,
                impact: "MEDIUM" as const,
                description: "组件衰减率变更将影响25年发电量预测"
            });
        }

        // 比较储能效率
        if (versionA.standards.storageArbitrage.roundTripEfficiency !==
            versionB.standards.storageArbitrage.roundTripEfficiency) {
            differences.push({
                path: "standards.storageArbitrage.roundTripEfficiency",
                oldValue: versionA.standards.storageArbitrage.roundTripEfficiency,
                newValue: versionB.standards.storageArbitrage.roundTripEfficiency,
                impact: "HIGH" as const,
                description: "充放电效率变更将直接影响储能套利收益"
            });
        }

        // 计算兼容性评分
        const highImpactCount = differences.filter(d => d.impact === "HIGH").length;
        const mediumImpactCount = differences.filter(d => d.impact === "MEDIUM").length;
        const compatibilityScore = 1 - (highImpactCount * 0.3 + mediumImpactCount * 0.15);

        return {
            versionA: versionIdA,
            versionB: versionIdB,
            differences,
            compatibilityScore: Math.max(0, compatibilityScore)
        };
    }

    /**
     * 分析版本升级对项目的影响
     */
    static async analyzeUpgradeImpact(
        projectId: string,
        newVersionId: string
    ): Promise<{
        currentVersion: string;
        newVersion: string;
        affectedCalculations: string[];
        estimatedDelta: {
            irr?: { current: number; new: number; delta: number };
            lcoe?: { current: number; new: number; delta: number };
            generation?: { current: number; new: number; delta: number };
        };
        recommendation: string;
    }> {
        // TODO: 实际实现需要重新计算项目
        return {
            currentVersion: CURRENT_ASSUMPTION_VERSION.id,
            newVersion: newVersionId,
            affectedCalculations: ["IRR", "LCOE", "25年总发电量"],
            estimatedDelta: {
                irr: { current: 8.5, new: 8.3, delta: -0.2 },
                lcoe: { current: 0.35, new: 0.36, delta: 0.01 }
            },
            recommendation: "建议保持当前版本，新版本对项目收益评估影响较小"
        };
    }

    /**
     * 验证口径版本是否适用于特定项目类型
     */
    static validateForProjectType(
        versionId: string,
        projectType: "SOLAR" | "WIND" | "STORAGE"
    ): { valid: boolean; warnings: string[] } {
        const version = this.getVersion(versionId);
        if (!version) {
            return { valid: false, warnings: ["版本不存在"] };
        }

        const warnings: string[] = [];

        // 检查是否已废弃
        if (version.deprecated) {
            warnings.push("该版本已废弃，建议使用最新版本");
        }

        // 检查生效日期
        if (version.effectiveDate > new Date()) {
            warnings.push("该版本尚未生效");
        }

        // 检查项目类型特定口径
        if (projectType === "STORAGE") {
            if (!version.standards.storageArbitrage) {
                warnings.push("该版本缺少储能相关口径定义");
            }
        }

        return {
            valid: warnings.length === 0 || version.deprecated === false,
            warnings
        };
    }
}

/**
 * 使用示例：
 * 
 * // 获取当前版本
 * const currentVersion = AssumptionManager.getCurrentVersion();
 * console.log(currentVersion.standards.lcoeCalculation.discountRate); // 0.08
 * 
 * // 比较版本
 * const comparison = AssumptionManager.compareVersions("v2024.1", "v2025.1");
 * console.log(comparison.differences); // 查看口径变更
 * 
 * // 分析升级影响
 * const impact = await AssumptionManager.analyzeUpgradeImpact(projectId, "v2025.1");
 * console.log(impact.estimatedDelta); // 查看指标变化
 */
