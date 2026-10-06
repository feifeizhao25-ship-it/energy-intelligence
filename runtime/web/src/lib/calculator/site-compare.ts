import { calculateSolar } from './solar';
import { calculateWind } from './wind';
import { calculateStorage } from './storage';
import { getPriceConfig } from '@/lib/policy/electricity-price';
import { getSolarResource, getWindResource } from '@/lib/api/nasa-power';
import { SiteComparisonOutput, EnergyResult, Recommendation, RiskLevel } from '@/types/comparison';
import { solveIrr, paybackPeriodOf } from './project-finance';

const UNASSESSED_BASIS = '未评估：未做资源年际波动、电价与政策变化、设备故障等风险分析';
export const RISK_LABEL: Record<RiskLevel, string> = { low: '低', medium: '中', high: '高', unassessed: '未评估' };

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

    // 4. 计算混合方案：合并逐年现金流后重新求 IRR
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
            riskLevel: 'unassessed',
            riskBasis: '测算未完成，无法评估',
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
    // 风险等级必须有依据；没有依据就标「未评估」，不再一律写死为低风险。
    let risk: RiskLevel = 'unassessed';
    let riskBasis = UNASSESSED_BASIS;

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
        const avgSpeed = meta.windResource.annual.avgSpeed;
        risk = avgSpeed < 5 ? 'high' : 'medium';
        riskBasis = `仅按资源判断：100 米年均风速 ${Number(avgSpeed).toFixed(1)} m/s，低于 5 m/s 判为高、否则为中；未评估电价与政策风险`;
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
        riskBasis,
        assumptions: type === 'SOLAR' ? { '装机容量(kWp)': 15, '自用比例(%)': 80 } : {},
        confidence: 'high',
        score: calculateScore(irr),
        details: data
    };
}

/**
 * 光储一体：把两边逐年现金流按年相加后重新求 IRR 和回收期（共用 project-finance 的求解器），
 * 不再按 0.7/0.3 加权两个 IRR、也不再给混合方案额外加分。
 * 光伏 25 年；储能 10 年，之后既不计收益也不计更换投资（假设写在 assumptions 里）。
 */
export function calculateHybrid(solar: EnergyResult, storage: EnergyResult): EnergyResult {
    const solarFlows: number[] | undefined = solar.details?.financial?.cashFlow;
    const storageFlows: number[] | undefined = storage.details?.financial?.cashFlows;
    if (!Array.isArray(solarFlows) || !Array.isArray(storageFlows) || !solar.capex || !storage.capex) {
        return {
            type: 'HYBRID', irr: null, paybackYears: null, annualRevenue: null, capex: solar.capex + storage.capex,
            riskLevel: 'unassessed', riskBasis: '缺少逐年现金流，无法合并测算', assumptions: {},
            confidence: 'low', score: 0, details: null,
        };
    }
    const totalCapex = solar.capex + storage.capex;
    const years = Math.max(solarFlows.length, storageFlows.length - 1);
    const combined = [-totalCapex];
    for (let t = 1; t <= years; t++) {
        combined.push((solarFlows[t - 1] ?? 0) + (storageFlows[t] ?? 0));
    }
    const irrFraction = solveIrr(combined);
    const irr = irrFraction === null ? null : irrFraction * 100;

    return {
        type: 'HYBRID',
        irr,
        paybackYears: paybackPeriodOf(totalCapex, combined.slice(1)),
        annualRevenue: (solar.annualRevenue || 0) + (storage.annualRevenue || 0),
        capex: totalCapex,
        riskLevel: 'unassessed',
        riskBasis: UNASSESSED_BASIS,
        assumptions: { '光伏寿命(年)': solarFlows.length, '储能寿命(年)': storageFlows.length - 1 },
        confidence: 'medium',
        score: irr === null ? 0 : calculateScore(irr),
        details: { solar: solar.details, storage: storage.details, cashFlows: combined }
    };
}

/** 评分只看 IRR（基准 8%），各方案同一口径，不对任何方案额外加分。 */
function calculateScore(irr: number): number {
    const base = 60;
    const bonus = (irr - 8) * 4;
    return Math.min(99, Math.max(0, base + bonus));
}

function determineRecommendation(solutions: EnergyResult[]): Recommendation {
    // 过滤有数值的方案
    const valid = solutions.filter(s => s.irr !== null && s.paybackYears !== null);

    // 排序：先看 IRR 是否高于 8% 基准，再按 IRR 高低。
    // 风险等级多数为「未评估」，不参与排序；也不再「混合方案优先」。
    const sorted = [...valid].sort((a, b) => {
        const aHighIrr = (a.irr || 0) > 8;
        const bHighIrr = (b.irr || 0) > 8;
        if (aHighIrr && !bHighIrr) return -1;
        if (!aHighIrr && bHighIrr) return 1;
        return (b.irr || 0) - (a.irr || 0);
    });

    const best = sorted[0];
    if (!best) {
        return { type: 'SOLAR', reasonSummary: ['各方案均未得到可确认的测算结果，暂不推荐。'], riskLevel: 'unassessed' };
    }
    const reasons = [
        `按当前假设，IRR 约 ${best.irr?.toFixed(1)}%（测算结果仅供参考）。`,
        `静态回收期约 ${best.paybackYears?.toFixed(1)} 年。`,
        best.riskLevel === 'unassessed'
            ? '风险等级：未评估（未分析资源年际波动、电价与政策变化）。'
            : `风险等级：${RISK_LABEL[best.riskLevel]}（${best.riskBasis}）。`,
    ];

    return {
        type: best.type,
        reasonSummary: reasons,
        riskLevel: best.riskLevel
    };
}
