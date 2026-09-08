import { createHash, randomUUID } from 'crypto';
import { verifiedSolar } from '@/lib/api/verified-solar';
import { projectFinance } from './project-finance';
import { QualityTag } from '../kernel/calculation-result';

export interface SolarCalculationParams {
    location: { lat: number; lng: number; address?: string };
    capacity: number;
    unitCost: number;
    electricityPrice: number;
    subsidyPrice?: number;
    qualityTag?: QualityTag;
}

/** 基于历史水平面辐照的初步估算，不提供工程审计或政策合规认证。 */
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
        const assumptions = {
            version: 'cn-solar-preview-2026-09-08', lifetime: 25, degradationRate: 0.005,
            discountRate: 0.08, performanceRatio: 0.8, annualOperatingCostRatio: 0.01,
            cashFlowTiming: '初始投资在第0年，收入和运维费用在每年年末',
        };
        const investment = params.capacity * 1000 * params.unitCost;
        const result = projectFinance({
            initialInvestment: investment,
            annualGeneration: params.capacity * resource.annualGHI * assumptions.performanceRatio,
            electricityPrice: params.electricityPrice + (params.subsidyPrice ?? 0),
            annualOperatingCost: investment * assumptions.annualOperatingCostRatio,
            lifetime: assumptions.lifetime, degradationRate: assumptions.degradationRate,
            discountRate: assumptions.discountRate,
        });
        const evidence = {
            conclusionId: randomUUID(),
            dataProvenance: {
                solarResource: {
                    source: resource.source, timestamp: resource.timestamp, cacheHit: false,
                    coordinates: params.location, temporalCoverage: resource.temporalCoverage,
                    parameters: ['ALLSKY_SFC_SW_DWN'],
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
                '使用上一完整年的历史水平面辐照，不能代表未来天气或倾斜组件实际入射辐照。',
                '综合效率、运维费率、折现率与衰减率均为明确列出的估算假设。',
                '未计税费、融资、储能、设备更换、弃光、价格变动和残值，不构成投资或工程审计结论。',
                '回收期为空表示寿命内未回本；内部收益率为空表示无可确认的唯一解。',
            ],
        };
    }
}
