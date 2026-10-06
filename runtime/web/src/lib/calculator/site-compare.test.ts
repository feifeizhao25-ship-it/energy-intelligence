import { compareSiteEnergies, calculateHybrid } from './site-compare';
import { solveIrr } from './project-finance';

// Mock dependencies
jest.mock('@/lib/policy/electricity-price', () => ({
    getPriceConfig: jest.fn(() => ({
        retailPrice: 1.0,
        feedInTariff: 0.4,
        peakPrice: 1.5,
        valleyPrice: 0.4,
        source: '来源待核实',
        freshness: { label: '电价数据截至 2025-12', stale: true, staleNote: '可能已变化，请以最新文件为准' },
    }))
}));

jest.mock('@/lib/api/nasa-power', () => ({
    getSolarResource: jest.fn(async () => ({ annual: { ghi: 1500, resourceClass: 'B' } })),
    getWindResource: jest.fn(async () => ({ annual: { avgSpeed: 6.0, powerDensity: 300 } }))
}));

// 光伏：投资 50,000，25 年每年净现金流 6,000；储能：投资 20,000，10 年每年净现金流 2,500
const solarCashFlow = Array(25).fill(6000);
const storageCashFlows = [-20000, ...Array(10).fill(2500)];
jest.mock('./solar', () => ({
    calculateSolar: jest.fn(async () => ({
        financial: { irr: 10, paybackYears: 6, year1Revenue: 10000, investment: 50000, cashFlow: Array(25).fill(6000) }
    }))
}));
jest.mock('./wind', () => ({
    calculateWind: jest.fn(async () => ({
        financial: { irr: 7, paybackYears: 9, year1Revenue: 8000, investment: 60000 }
    }))
}));
jest.mock('./storage', () => ({
    calculateStorage: jest.fn(async () => ({
        financial: {
            metrics: { irr: 4.3, paybackYears: 8, annualRevenue: 2000 },
            investment: { total: 20000 },
            cashFlows: [-20000, ...Array(10).fill(2500)],
        }
    }))
}));

describe('site-compare 方案对比', () => {
    it('按 IRR 推荐，理由不再写死「经济表现优异」', async () => {
        const result = await compareSiteEnergies({ lat: 30, lng: 120, province: '浙江' });

        expect(result.solar.irr).toBe(10);
        expect(result.wind.irr).toBe(7);
        expect(result.recommendation.type).toBe('SOLAR');
        expect(result.recommendation.reasonSummary.join('')).not.toContain('优异');
    });

    it('没有依据的风险等级标为「未评估」，不再写死为低风险；风电写明依据', async () => {
        const result = await compareSiteEnergies({ lat: 30, lng: 120, province: '浙江' });
        expect(result.solar.riskLevel).toBe('unassessed');
        expect(result.storage.riskLevel).toBe('unassessed');
        expect(result.hybrid.riskLevel).toBe('unassessed');
        expect(result.wind.riskLevel).toBe('medium');
        expect(result.wind.riskBasis).toContain('6.0 m/s');
        expect(result.recommendation.reasonSummary.join('')).toContain('未评估');
    });

    it('光储一体 IRR 按合并现金流重新求，不是 0.7/0.3 加权，也不加 5 分', async () => {
        const result = await compareSiteEnergies({ lat: 30, lng: 120, province: '浙江' });
        // 手算合并现金流：第 0 年 −70,000；第 1–10 年 6,000 + 2,500 = 8,500；第 11–25 年 6,000
        const combined = [-70000, ...Array(10).fill(8500), ...Array(15).fill(6000)];
        const expected = solveIrr(combined)! * 100;
        expect(result.hybrid.irr).toBeCloseTo(expected, 6);
        expect(result.hybrid.irr).not.toBeCloseTo(10 * 0.7 + 4.3 * 0.3, 1);
        // 评分与单一方案同一口径：60 + (IRR − 8) × 4
        expect(result.hybrid.score).toBeCloseTo(Math.min(99, Math.max(0, 60 + (expected - 8) * 4)), 6);
        // 回收期：前 8 年累计 68,000，第 9 年补足 2,000 → 8 + 2000/8500
        expect(result.hybrid.paybackYears).toBeCloseTo(8 + 2000 / 8500, 6);
    });

    it('缺少逐年现金流时混合方案不给数值', () => {
        const base = { irr: 10, paybackYears: 5, annualRevenue: 1, capex: 1, riskLevel: 'unassessed' as const, riskBasis: '', assumptions: {}, confidence: 'high' as const, score: 0 };
        const hybrid = calculateHybrid({ ...base, type: 'SOLAR', details: {} }, { ...base, type: 'STORAGE', details: {} });
        expect(hybrid.irr).toBeNull();
        expect(solarCashFlow.length + storageCashFlows.length).toBe(36);
    });
});
