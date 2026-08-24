import { calculateSolar } from './solar';
import { calculateWind } from './wind';
import { calculateStorage } from './storage';
import { getPriceConfig } from '@/lib/policy/electricity-price';
import { getSolarResource, getWindResource } from '@/lib/api/nasa-power';
import { SiteComparisonOutput, EnergyResult, Recommendation, RiskLevel, ConfidenceLevel } from '@/types/comparison';

export async function compareSiteEnergies(input: {
    lat: number;
    lng: number;
    province: string;
    address?: string;
}): Promise<SiteComparisonOutput> {
    const { lat, lng, province } = input;
    const priceConfig = getPriceConfig(province);

    // 1. 并行获取资源数据
    const [solarResource, windResource] = await Promise.all([
        getSolarResource(lat, lng),
        getWindResource(lat, lng)
    ]);

    // 2. 执行各能种测算
    const results = await Promise.allSettled([
        // Solar
        calculateSolar({
            lat, lng, province,
            capacity: 15,
            installationType: 'roof',
            moduleType: 'standard',
            selfUseRatio: 0.8,
            electricityPrice: priceConfig.retailPrice,
            feedInTariff: priceConfig.feedInTariff
        }),
        // Wind
        calculateWind({
            lat, lng, province,
            projectName: 'Production Assess',
            turbine: {
                type: 'low_wind',
                capacity: 0.005,
                count: 1,
                hubHeight: 18,
                rotorDiameter: 5,
                cutInSpeed: 2.5,
                ratedSpeed: 10,
                cutOutSpeed: 25
            },
            businessModel: {
                mode: 'self_use_export',
                selfUseRatio: 0.8,
                electricityPrice: priceConfig.retailPrice,
                feedInTariff: priceConfig.feedInTariff
            },
            investment: { unitCost: 6000 },
            operation: { operationYears: 20 }
        }),
        // Storage
        calculateStorage({
            energy: 10,
            capacity: 5,
            batteryType: 'lithium',
            location: { province, lat, lng },
            applicationMode: 'arbitrage',
            arbitrageConfig: {
                chargeTime1: [23, 7],
                dischargeTime1: [10, 15],
                peakPrice: priceConfig.peakPrice || priceConfig.retailPrice * 1.5,
                valleyPrice: priceConfig.valleyPrice || priceConfig.retailPrice * 0.4,
                flatPrice: priceConfig.retailPrice
            },
            investment: { unitCost: 1500, financing: 'cash' },
            technical: {
                efficiency: 90,
                dod: 90,
                cycleLife: 6000,
                degradationRate: 2,
                maintenanceCostRatio: 1
            }
        })
    ]);

    // 3. 构造标准化结果
    const solar = transformToEnergyResult('SOLAR', results[0], { solarResource });
    const wind = transformToEnergyResult('WIND', results[1], { windResource });
    const storage = transformToEnergyResult('STORAGE', results[2], { priceConfig });

    // 4. 计算混合方案 (简化估算)
    const hybrid = calculateHybrid(solar, storage);

    // 5. 确定性推荐逻辑
    const recommendation = determineRecommendation([solar, wind, storage, hybrid]);

    return {
        lat, lng,
        address: input.address,
        solar,
        wind,
        storage,
        hybrid,
        recommendation,
        metadata: {
            dataSources: ['NASA POWER', 'Local Utility Rates (2024)', '新能源智库计算引擎 V1'],
            calculationVersion: '1.0.0-prod',
            timestamp: new Date().toISOString()
        },
        resourceData: {
            solarGHI: solarResource.annual.ghi,
            avgWindSpeed: windResource.annual.avgSpeed
        }
    };
}

function transformToEnergyResult(type: EnergyResult['type'], settled: PromiseSettledResult<any>, meta: any): EnergyResult {
    if (settled.status === 'rejected') {
        return {
            type,
            irr: null,
            paybackYears: null,
            annualRevenue: null,
            capex: 0,
            riskLevel: 'high',
            assumptions: {},
            confidence: 'low',
            score: 0,
            details: null
        };
    }

    const data = settled.value;
    let irr = 0;
    let payback = 0;
    let revenue = 0;
    let capex = 0;
    let risk: RiskLevel = 'low';

    if (type === 'SOLAR') {
        irr = data.financial.irr;
        payback = data.financial.paybackYears;
        revenue = data.financial.year1Revenue;
        capex = data.financial.investment;
    } else if (type === 'WIND') {
        irr = data.financial.irr;
        payback = data.financial.paybackYears;
        revenue = data.financial.year1Revenue;
        capex = data.financial.investment;
        risk = meta.windResource.annual.avgSpeed < 5 ? 'high' : 'medium';
    } else if (type === 'STORAGE') {
        irr = data.financial.metrics.irr;
        payback = data.financial.metrics.paybackYears;
        revenue = data.financial.metrics.annualRevenue;
        capex = data.financial.investment.total;
    }

    return {
        type,
        irr,
        paybackYears: payback,
        annualRevenue: revenue,
        capex,
        riskLevel: risk,
        assumptions: type === 'SOLAR' ? { '屋顶面积': 100, '自用比例': 80 } : {},
        confidence: 'high',
        score: calculateScore(irr, type),
        details: data
    };
}

function calculateHybrid(solar: EnergyResult, storage: EnergyResult): EnergyResult {
    if (!solar.irr || !storage.irr) {
        return { ...solar, type: 'HYBRID', irr: null, confidence: 'low' };
    }
    const totalCapex = solar.capex + storage.capex;
    const totalRevenue = (solar.annualRevenue || 0) + (storage.annualRevenue || 0);
    const weightedIrr = (solar.irr * 0.7 + storage.irr * 0.3);

    return {
        type: 'HYBRID',
        irr: weightedIrr,
        paybackYears: ((solar.paybackYears || 10) + (storage.paybackYears || 10)) / 2,
        annualRevenue: totalRevenue,
        capex: totalCapex,
        riskLevel: 'low',
        assumptions: { '混合消纳率': 95 },
        confidence: 'medium',
        score: calculateScore(weightedIrr, 'HYBRID'),
        details: { solar: solar.details, storage: storage.details }
    };
}

function calculateScore(irr: number, type: string): number {
    const base = 60;
    const bonus = (irr - 8) * 4;
    let final = base + bonus;
    if (type === 'HYBRID') final += 5; // 稳定性加分
    return Math.min(99, Math.max(0, final));
}

function determineRecommendation(solutions: EnergyResult[]): Recommendation {
    // 过滤有数值的方案
    const valid = solutions.filter(s => s.irr !== null && s.paybackYears !== null);

    // 优先级排序：
    // 1. IRR > 8% 且回收期最短
    // 2. 风险等级最低
    // 3. 混合方案优先

    const sorted = [...valid].sort((a, b) => {
        // 1. 风险优先级
        const riskOrder = { low: 0, medium: 1, high: 2 };
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
            return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }

        // 2. IRR 阈值 (8%)
        const aHighIrr = (a.irr || 0) > 8;
        const bHighIrr = (b.irr || 0) > 8;
        if (aHighIrr && !bHighIrr) return -1;
        if (!aHighIrr && bHighIrr) return 1;

        // 3. 混合方案优先 (若 IRR 差距不大，< 1%)
        if (a.type === 'HYBRID' && Math.abs((a.irr || 0) - (b.irr || 0)) < 1) return -1;
        if (b.type === 'HYBRID' && Math.abs((a.irr || 0) - (b.irr || 0)) < 1) return 1;

        // 4. IRR 绝对值
        return (b.irr || 0) - (a.irr || 0);
    });

    const best = sorted[0];
    const reasons = [
        `IRR 预计可达 ${best.irr?.toFixed(1)}%，经济表现优异。`,
        `投资回收期约 ${best.paybackYears?.toFixed(1)} 年，资金流动性较好。`,
        `风险评级为“${best.riskLevel === 'low' ? '低' : (best.riskLevel === 'medium' ? '中' : '高')}”，适合${best.riskLevel === 'low' ? '稳健型' : '成长型'}投资人。`
    ];

    return {
        type: best.type,
        reasonSummary: reasons,
        riskLevel: best.riskLevel
    };
}
