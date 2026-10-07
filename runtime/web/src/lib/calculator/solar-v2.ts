import { createHash, randomUUID } from 'crypto';
import { verifiedSolar, toSolarResource } from '@/lib/api/verified-solar';
import { paybackPeriodOf, solveIrr } from './project-finance';
import { simulateSolar, FINANCE_ASSUMPTIONS, LOSS_ASSUMPTIONS } from './solar';
import { QualityTag } from '../kernel/calculation-result';

export interface SolarCalculationParams {
    location: { lat: number; lng: number; address?: string };
    capacity: number;
    unitCost: number;
    electricityPrice: number;
    subsidyPrice?: number;
    qualityTag?: QualityTag;
}

/** 初步估算的固定设定：没有让用户选安装形式和组件档位，按屋顶 + 标准组件、最佳倾角、正南计算。 */
export const V2_MODEL_DEFAULTS = { installationType: 'roof', moduleType: 'standard' } as const;

/**
 * 基于历史水平面辐照的初步估算，不提供工程审计或政策合规认证。
 * 发电量与财务都由统一光伏模型 simulateSolar 计算（与快速测算同一套），这里只负责取数、留证据和换成本接口的返回格式。
 */
export class SolarCalculatorV2 {
    static async calculate(params: SolarCalculationParams) {
        if (!params || !params.location || !Number.isFinite(params.capacity) || params.capacity <= 0
            || !Number.isFinite(params.unitCost) || params.unitCost <= 0
            || !Number.isFinite(params.electricityPrice) || params.electricityPrice < 0
            || (params.subsidyPrice !== undefined && (!Number.isFinite(params.subsidyPrice) || params.subsidyPrice < 0))) {
            throw new Error('INVALID_SOLAR_INPUT');
        }
        if (params.qualityTag && !['PREVIEW', 'STANDARD', 'AUDIT_GRADE'].includes(params.qualityTag)) throw new Error('INVALID_QUALITY_TAG');
        if (params.qualityTag === 'AUDIT_GRADE') throw new Error('AUDIT_GRADE_UNAVAILABLE');
        const resource = await verifiedSolar(params.location.lat, params.location.lng);
        // 用户填写的是「每度电的平均价值」（已综合自用与上网），按全部电量同一价格计
        const pricePerKWh = params.electricityPrice + (params.subsidyPrice ?? 0);
        const model = simulateSolar(toSolarResource(resource, params.location.lat), {
            capacity: params.capacity,
            ...V2_MODEL_DEFAULTS,
            unitCost: params.unitCost * 1000, // 元/W → 元/kW
            selfUsePrice: pricePerKWh,
            feedInPrice: pricePerKWh,
            selfUseRatio: 1,
        });
        const { firstYearDegradation, annualDegradation } = model.assumptions!;
        const assumptions = {
            version: 'cn-solar-unified-2026-10-07', lifetime: FINANCE_ASSUMPTIONS.lifetimeYears,
            // 兼容旧字段：degradationRate 为第 2 年起的年衰减（小数），首年衰减另列
            degradationRate: annualDegradation / 100, firstYearDegradationRate: firstYearDegradation / 100,
            discountRate: FINANCE_ASSUMPTIONS.discountRate,
            // 综合效率 = 模型算出的首年系统性能比（含遮挡、失配、线损、逆变器、灰尘、交流损耗与温度）
            performanceRatio: model.energy.pr,
            annualOperatingCostRatio: FINANCE_ASSUMPTIONS.omCostRatio, operatingCostEscalation: FINANCE_ASSUMPTIONS.omEscalation,
            installationType: V2_MODEL_DEFAULTS.installationType, moduleType: V2_MODEL_DEFAULTS.moduleType,
            lossAssumptions: LOSS_ASSUMPTIONS,
            cashFlowTiming: '初始投资在第0年，收入和运维费用在每年年末',
        };
        const investment = model.financial.investment;
        const revenue = model.financial.revenue ?? [];
        const yearlyGeneration = model.energy.annual ?? [];
        const cashFlow = model.financial.cashFlow.map((netCashFlow, index) => ({
            year: index + 1,
            generation: yearlyGeneration[index],
            revenue: revenue[index],
            cost: revenue[index] - netCashFlow, // 当年运维费
            netCashFlow,
        }));
        const irr = solveIrr([-investment, ...model.financial.cashFlow]);
        const result = {
            initialInvestment: investment,
            annualGeneration: model.energy.year1,
            monthlyGeneration: model.energy.monthly,
            planeIrradiation: model.energy.planeIrradiation,
            totalGeneration: model.energy.lifetime,
            totalRevenue: revenue.reduce((sum, r) => sum + r, 0),
            npv: model.financial.npv,
            irr: irr === null ? null : irr * 100,
            lcoe: model.financial.lcoe,
            paybackPeriod: paybackPeriodOf(investment, model.financial.cashFlow),
            cashFlow,
        };
        const evidence = {
            conclusionId: randomUUID(),
            dataProvenance: {
                solarResource: {
                    source: resource.source, timestamp: resource.timestamp, cacheHit: false,
                    coordinates: params.location, temporalCoverage: resource.temporalCoverage,
                    parameters: ['ALLSKY_SFC_SW_DWN', 'T2M'],
                    metadata: { annualGHI: resource.annualGHI, units: resource.units, requestUrl: resource.requestUrl,
                        responseSha256: resource.responseSha256, rawResponse: resource.rawResponse },
                },
                electricityPrice: { source: '用户输入', timestamp: new Date(), cacheHit: false,
                    metadata: { electricityPrice: params.electricityPrice, subsidyPrice: params.subsidyPrice ?? 0, policyVerified: false } },
            },
            regulatoryCompliance: [],
        };
        const snapshot = { input: params, assumptions, result, evidence };
        return {
            result, assumptions, evidence,
            auditMeta: { id: randomUUID(), version: 'solar-calculator@3.0.0',
                assumptionVersion: assumptions.version, qualityTag: 'PREVIEW' as const,
                hash: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
                reproducible: true, executedAt: new Date() },
            input: params, createdAt: new Date(),
            limitations: [
                '使用上一完整年的历史水平面辐照和气温，不能代表未来天气；倾斜面辐照为近似换算，未做直射/散射分解。',
                '按屋顶安装、标准组件、最佳倾角、正南朝向估算；各项损耗、运维费率、折现率与衰减率均为明确列出的估算假设。',
                '未计税费、融资、储能、设备更换、弃光、价格变动和残值，不构成投资或工程审计结论。',
                '回收期为空表示寿命内未回本；内部收益率为空表示无可确认的唯一解。',
            ],
        };
    }
}
