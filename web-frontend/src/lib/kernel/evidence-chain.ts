/**
 * 证据链系统
 * 
 * 核心思想：每个计算/诊断结果都可追溯到原始数据源
 * - 数据来源可验证
 * - 计算过程可复现
 * - 不确定性可量化
 * - 审计友好
 */

import { AssumptionManager } from './assumption-manager';

/**
 * 数据来源信息
 */
export interface DataProvenance {
    source: string;          // 数据源名称
    timestamp: Date;          // 数据获取时间
    version?: string;         // 数据源版本
    cacheHit: boolean;        // 是否命中缓存
    metadata?: Record<string, any>; // 额外元数据
}

/**
 * 太阳辐照数据来源
 */
export interface SolarResourceProvenance extends DataProvenance {
    source: "NASA POWER" | "Open-Meteo" | "Forecast.Solar";
    coordinates: { lat: number; lng: number };
    parameters: string[];     // ghi, dni, dhi等
    temporalCoverage: { start: Date; end: Date };
}

/**
 * 电价数据来源
 */
export interface ElectricityPriceProvenance extends DataProvenance {
    source: "国家发改委" | "地方发改委" | "用户输入";
    policyDocument?: string;  // 政策文件编号
    effectiveDate?: Date;     // 政策生效日期
    region: string;           // 适用地区
}

/**
 * 监测数据来源
 */
export interface MonitoringDataProvenance extends DataProvenance {
    source: "电站监测";
    stationId: string;
    recordCount: number;
    dateRange: { start: Date; end: Date };
    completeness: number;     // 数据完整性 0-1
    sensors: string[];        // 传感器列表
}

/**
 * 计算元数据
 */
export interface CalculationMeta {
    assumptionVersion: string;  // 口径版本
    engineVersion: string;      // 计算引擎版本
    executedAt: Date;           // 执行时间
    executionTimeMs: number;    // 执行耗时

    /** 关键中间变量 - 用于审计和调试 */
    intermediateValues?: Record<string, number>;
}

/**
 * 不确定性分析
 */
export interface UncertaintyAnalysis {
    confidenceLevel: number;  // 置信度，如 0.95
    errorBound: Record<string, { lower: number; upper: number }>;
    sensitivityFactors?: Array<{
        factor: string;
        impact: number;       // 影响权重
    }>;
}

/**
 * 完整证据链
 */
export interface EvidenceChain {
    /** 结论ID */
    conclusionId: string;

    /** 数据来源追溯 */
    dataProvenance: {
        solarResource?: SolarResourceProvenance;
        electricityPrice?: ElectricityPriceProvenance;
        monitoringData?: MonitoringDataProvenance;
        [key: string]: DataProvenance | undefined;
    };

    /** 计算元数据 */
    calculationMeta: CalculationMeta;

    /** 不确定性分析 */
    uncertaintyAnalysis?: UncertaintyAnalysis;

    /** 关联的学术证据 */
    referencePapers?: Array<{
        paperId: string;
        title: string;
        relevance: string;
    }>;

    /** 合规标准 */
    regulatoryCompliance: string[];

    /** 创建时间 */
    createdAt: Date;
}

/**
 * 可复现命令
 */
export interface ReproduceCommand {
    endpoint: string;
    method: string;
    body: Record<string, any>;
    expectedHash: string;     // 结果哈希
    assumptionVersion: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
    valid: boolean;
    completeness: number;     // 0-1
    missingFields: string[];
    warnings: string[];
}

/**
 * 证据链构建器
 */
export class EvidenceBuilder {
    private evidence: Partial<EvidenceChain>;

    constructor(conclusionId: string) {
        this.evidence = {
            conclusionId,
            dataProvenance: {},
            regulatoryCompliance: [],
            createdAt: new Date()
        };
    }

    /**
     * 添加数据来源
     */
    addDataSource(key: string, provenance: DataProvenance): this {
        this.evidence.dataProvenance![key] = provenance;
        return this;
    }

    /**
     * 添加太阳辐照数据来源
     */
    addSolarResource(provenance: SolarResourceProvenance): this {
        this.evidence.dataProvenance!.solarResource = provenance;
        return this;
    }

    /**
     * 添加电价数据来源
     */
    addElectricityPrice(provenance: ElectricityPriceProvenance): this {
        this.evidence.dataProvenance!.electricityPrice = provenance;
        return this;
    }

    /**
     * 添加监测数据来源
     */
    addMonitoringData(provenance: MonitoringDataProvenance): this {
        this.evidence.dataProvenance!.monitoringData = provenance;
        return this;
    }

    /**
     * 添加计算元数据
     */
    addCalculationMeta(meta: CalculationMeta): this {
        this.evidence.calculationMeta = meta;
        return this;
    }

    /**
     * 添加不确定性分析
     */
    addUncertaintyAnalysis(analysis: UncertaintyAnalysis): this {
        this.evidence.uncertaintyAnalysis = analysis;
        return this;
    }

    /**
     * 添加学术参考文献
     */
    addReferencePaper(paperId: string, title: string, relevance: string): this {
        if (!this.evidence.referencePapers) {
            this.evidence.referencePapers = [];
        }
        this.evidence.referencePapers.push({ paperId, title, relevance });
        return this;
    }

    /**
     * 添加合规标准
     */
    addRegulatoryCompliance(standard: string): this {
        this.evidence.regulatoryCompliance!.push(standard);
        return this;
    }

    /**
     * 构建证据链
     */
    build(): EvidenceChain {
        // 自动添加口径版本
        if (!this.evidence.calculationMeta) {
            throw new Error("Calculation meta is required");
        }

        return this.evidence as EvidenceChain;
    }

    /**
     * 验证证据完整性
     */
    validate(): ValidationResult {
        const missing: string[] = [];
        const warnings: string[] = [];

        // 必需字段检查
        if (!this.evidence.calculationMeta) {
            missing.push("calculationMeta");
        }

        if (Object.keys(this.evidence.dataProvenance || {}).length === 0) {
            missing.push("dataProvenance (至少一个数据源)");
        }

        // 建议字段检查
        if (!this.evidence.uncertaintyAnalysis) {
            warnings.push("建议添加不确定性分析以提升可信度");
        }

        if (!this.evidence.regulatoryCompliance ||
            this.evidence.regulatoryCompliance.length === 0) {
            warnings.push("建议添加合规标准引用");
        }

        const totalFields = 6; // 总字段数
        const providedFields = totalFields - missing.length;
        const completeness = providedFields / totalFields;

        return {
            valid: missing.length === 0,
            completeness,
            missingFields: missing,
            warnings
        };
    }

    /**
     * 生成可复现命令
     */
    generateReproduceCommand(
        endpoint: string,
        method: string,
        params: Record<string, any>,
        resultHash: string
    ): ReproduceCommand {
        return {
            endpoint,
            method,
            body: params,
            expectedHash: resultHash,
            assumptionVersion: this.evidence.calculationMeta?.assumptionVersion ||
                AssumptionManager.getCurrentVersion().id
        };
    }
}

/**
 * 证据链验证器
 */
export class EvidenceValidator {
    /**
     * 验证证据链的真实性
     */
    static verify(evidence: EvidenceChain): {
        verified: boolean;
        issues: string[];
    } {
        const issues: string[] = [];

        // 检查数据源时效性
        for (const [key, provenance] of Object.entries(evidence.dataProvenance)) {
            if (provenance) {
                const ageInDays = (Date.now() - provenance.timestamp.getTime()) /
                    (1000 * 60 * 60 * 24);

                if (ageInDays > 365) {
                    issues.push(`${key}数据过时(${Math.floor(ageInDays)}天前)`);
                }
            }
        }

        // 检查口径版本
        const version = AssumptionManager.getVersion(
            evidence.calculationMeta.assumptionVersion
        );
        if (!version) {
            issues.push("使用的口径版本不存在");
        } else if (version.deprecated) {
            issues.push("使用的口径版本已废弃");
        }

        // 检查合规标准
        if (!evidence.regulatoryCompliance ||
            evidence.regulatoryCompliance.length === 0) {
            issues.push("缺少合规标准引用");
        }

        return {
            verified: issues.length === 0,
            issues
        };
    }

    /**
     * 比较两个证据链
     */
    static compare(
        evidenceA: EvidenceChain,
        evidenceB: EvidenceChain
    ): {
        identical: boolean;
        differences: string[];
    } {
        const differences: string[] = [];

        // 比较口径版本
        if (evidenceA.calculationMeta.assumptionVersion !==
            evidenceB.calculationMeta.assumptionVersion) {
            differences.push(
                `口径版本不同: ${evidenceA.calculationMeta.assumptionVersion} vs ` +
                `${evidenceB.calculationMeta.assumptionVersion}`
            );
        }

        // 比较数据源
        const keysA = Object.keys(evidenceA.dataProvenance);
        const keysB = Object.keys(evidenceB.dataProvenance);

        if (keysA.length !== keysB.length) {
            differences.push("数据源数量不同");
        }

        for (const key of keysA) {
            if (!evidenceB.dataProvenance[key]) {
                differences.push(`数据源差异: B缺少${key}`);
            } else {
                const provA = evidenceA.dataProvenance[key]!;
                const provB = evidenceB.dataProvenance[key]!;

                if (provA.source !== provB.source) {
                    differences.push(`${key}数据源不同: ${provA.source} vs ${provB.source}`);
                }
            }
        }

        return {
            identical: differences.length === 0,
            differences
        };
    }
}

/**
 * 使用示例：
 * 
 * // 构建证据链
 * const evidence = new EvidenceBuilder("calc-solar-2024-001")
 *   .addSolarResource({
 *     source: "NASA POWER",
 *     coordinates: { lat: 39.9, lng: 116.4 },
 *     timestamp: new Date(),
 *     cacheHit: false,
 *     parameters: ["ghi", "dni", "dhi"],
 *     temporalCoverage: { start: new Date("2023-01-01"), end: new Date("2023-12-31") }
 *   })
 *   .addElectricityPrice({
 *     source: "国家发改委",
 *     timestamp: new Date(),
 *     cacheHit: true,
 *     policyDocument: "发改价格〔2023〕1234号",
 *     effectiveDate: new Date("2023-07-01"),
 *     region: "北京市"
 *   })
 *   .addCalculationMeta({
 *     assumptionVersion: "v2024.1",
 *     engineVersion: "calculator@2.1.0",
 *     executedAt: new Date(),
 *     executionTimeMs: 150,
 *     intermediateValues: {
 *       annualGHI: 1456.7,
 *       temperatureCorrectedPower: 98.2
 *     }
 *   })
 *   .addUncertaintyAnalysis({
 *     confidenceLevel: 0.95,
 *     errorBound: {
 *       irr: { lower: 7.2, upper: 9.8 },
 *       generation: { lower: 138000, upper: 152000 }
 *     }
 *   })
 *   .addRegulatoryCompliance("IEC 61724-1:2017")
 *   .addRegulatoryCompliance("NREL ATB 2023")
 *   .build();
 * 
 * // 验证证据链
 * const validation = new EvidenceBuilder("test").validate();
 * console.log(validation.valid); // false
 * console.log(validation.missingFields); // ["calculationMeta"]
 * 
 * // 验证真实性
 * const verification = EvidenceValidator.verify(evidence);
 * console.log(verification.verified); // true/false
 */
