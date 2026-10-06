/** unassessed = 未评估：没有做资源波动、电价与政策变化分析时不能给出风险等级 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'unassessed';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface EnergyResult {
    type: 'SOLAR' | 'WIND' | 'STORAGE' | 'HYBRID';
    irr: number | null;
    paybackYears: number | null;
    annualRevenue: number | null;
    capex: number;
    riskLevel: RiskLevel;
    riskBasis: string; // 风险等级的依据；未评估时写明未评估的原因
    assumptions: Record<string, number>;
    confidence: ConfidenceLevel;
    score: number; // 0-100 综合评分
    details: any; // 原始计算对象引用
}

export interface Recommendation {
    type: 'SOLAR' | 'WIND' | 'STORAGE' | 'HYBRID';
    reasonSummary: string[];
    riskLevel: RiskLevel;
}

export interface SiteComparisonOutput {
    lat: number;
    lng: number;
    address?: string;
    solar: EnergyResult;
    wind: EnergyResult;
    storage: EnergyResult;
    hybrid: EnergyResult;
    recommendation: Recommendation;
    metadata: {
        dataSources: string[];
        calculationVersion: string;
        timestamp: string;
    };
    resourceData: {
        solarGHI: number;
        avgWindSpeed: number;
        elevation?: number;
    };
}
