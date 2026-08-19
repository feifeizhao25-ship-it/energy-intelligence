import { calculateSolar } from './solar';
import { calculateWind } from './wind';
import { calculateStorage } from './storage';
import { getPriceConfig } from '@/lib/policy/electricity-price';
import { getSolarResource, getWindResource } from '@/lib/api/nasa-power';
import { SiteComparisonResult, EnergySolutionResult } from '@/types/comparison';

export async function compareSiteEnergies(input: {
    lat: number;
    lng: number;
    province: string;
    address?: string;
}): Promise<SiteComparisonResult> {
    const { lat, lng, province } = input;
    const priceConfig = getPriceConfig(province);

    // 1. 并行获取资源数据
    const [solarResource, windResource] = await Promise.all([
        getSolarResource(lat, lng),
        getWindResource(lat, lng)
    ]);

    // 2. 并行执行各能种标准化测算
    const results = await Promise.allSettled([
        // A. 光伏 (标准屋顶 15kWp)
        calculateSolar({
            lat, lng, province,
            capacity: 15,
            installationType: 'roof',
            moduleType: 'standard',
            selfUseRatio: 0.8,
            electricityPrice: priceConfig.retailPrice,
            feedInTariff: priceConfig.feedInTariff
        }),
        // B. 风电 (5kW 分散式)
        calculateWind({
            lat, lng, province,
            projectName: 'Quick Assess',
            turbine: {
                type: 'low_wind',
                capacity: 0.005, // 5kW = 0.005MW
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
        // C. 储能 (10kWh 削峰填谷)
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

    const solutions: EnergySolutionResult[] = [];

    // 解析结果
    const solarData = results[0].status === 'fulfilled' ? results[0].value : null;
    const windData = results[1].status === 'fulfilled' ? results[1].value : null;
    const storageData = results[2].status === 'fulfilled' ? results[2].value : null;

    if (solarData) {
        solutions.push({
            type: 'SOLAR',
            irr: solarData.financial.irr,
            paybackYears: solarData.financial.paybackYears,
            annualRevenue: solarData.financial.year1Revenue,
            investment: solarData.financial.investment,
            riskLevel: 'LOW',
            score: calculateScore(solarData.financial.irr, 15),
            details: solarData
        });
    }

    if (windData) {
        solutions.push({
            type: 'WIND',
            irr: windData.financial.irr,
            paybackYears: windData.financial.paybackYears,
            annualRevenue: windData.financial.year1Revenue,
            investment: windData.financial.investment,
            riskLevel: windResource.annual.avgSpeed < 5 ? 'HIGH' : 'MEDIUM',
            score: calculateScore(windData.financial.irr, 20),
            details: windData
        });
    }

    if (storageData) {
        solutions.push({
            type: 'STORAGE',
            irr: storageData.financial.metrics.irr,
            paybackYears: storageData.financial.metrics.paybackYears,
            annualRevenue: storageData.financial.metrics.annualRevenue,
            investment: storageData.financial.investment.total,
            riskLevel: 'LOW',
            score: calculateScore(storageData.financial.metrics.irr, 10),
            details: storageData
        });
    }

    // D. 混合方案 (Solar + Storage) - 简化逻辑
    if (solarData && storageData) {
        const combinedInvestment = solarData.financial.investment + storageData.financial.investment.total;
        const combinedRevenue = solarData.financial.year1Revenue + storageData.financial.metrics.annualRevenue;
        // 粗略估算 IRR (取加权平均或重新模拟，此处由于是 Phase 1 快速评估，采用加权估算)
        const hybridIRR = (solarData.financial.irr * 0.7 + storageData.financial.metrics.irr * 0.3);

        solutions.push({
            type: 'HYBRID',
            irr: hybridIRR,
            paybackYears: (solarData.financial.paybackYears + storageData.financial.metrics.paybackYears) / 2,
            annualRevenue: combinedRevenue,
            investment: combinedInvestment,
            riskLevel: 'LOW',
            score: calculateScore(hybridIRR, 15) + 5, // 混合方案通常得分更高因为更稳健
            details: { solar: solarData, storage: storageData }
        });
    }

    // 排序并推荐
    solutions.sort((a, b) => b.score - a.score);
    const best = solutions[0];

    return {
        lat, lng,
        address: input.address,
        solutions,
        recommendedType: best.type,
        recommendationReason: generateReason(best, solarResource, windResource, priceConfig),
        resourceData: {
            solarGHI: solarResource.annual.ghi,
            avgWindSpeed: windResource.annual.avgSpeed
        }
    };
}

function calculateScore(irr: number, weight: number): number {
    // 简单的评分逻辑：IRR越高分越高，基准为 8%
    const baseScore = 60;
    const irrBonus = (irr - 8) * 5;
    return Math.min(98, Math.max(0, baseScore + irrBonus));
}

function generateReason(best: EnergySolutionResult, solar: any, wind: any, price: any): string {
    if (best.type === 'HYBRID') {
        return `首选推荐“光储一体化”。当地日照充足（年均 ${Math.round(solar.annual.ghi)} kWh/m²），且${price.peakValleySupport ? '峰谷价差明显，' : ''}储能可显著消纳光伏余电，提升整体回报率。`;
    }
    if (best.type === 'SOLAR') {
        return `首选推荐“分布式光伏”。当地太阳能资源处于 ${solar.annual.resourceClass} 类区，且安装成本低、技术成熟，IRR 达到 ${best.irr.toFixed(1)}%，是稳健投资的首选。`;
    }
    if (best.type === 'WIND') {
        return `首选推荐“分散式风电”。当地年均风速高达 ${wind.annual.avgSpeed.toFixed(1)} m/s，风能资源极佳，在对应容量下具备更强的发电能力。`;
    }
    return `根据初步评估，${best.type} 方案在当前电价政策下具备较好的投资回报。`;
}
