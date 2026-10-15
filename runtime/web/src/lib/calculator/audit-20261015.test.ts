// 2026-10-15 口径审计：PR / 自用比例 / LCOE / 风速外推 的手算参考用例
import { performanceRatio, annualEnergyKWh, normalizeSelfUseRatio, degradationFactor } from './solar';
import { discountedLcoe } from './project-finance';
import { extrapolateWindSpeed } from './wind-shear';
import { calculateWind, windSelfUseRatio } from './wind';

jest.mock('@/lib/api/nasa-power', () => ({
    getWindResource: jest.fn(async () => ({
        annual: { avgSpeed: 7, powerDensity: 350 },
        monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, speed50m: 7, powerDensity: 350 })),
    })),
}));

describe('PR（年累计辐照，不乘 365）', () => {
    it('1000 kWp × 1500 kWh/m² × 0.8 → PR = 0.8', () => {
        const e = annualEnergyKWh(1000, 1500, 0.8);
        expect(e).toBe(1_200_000);
        expect(performanceRatio(e, 1000, 1500)).toBeCloseTo(0.8, 10);
    });
    it('零装机/零辐照返回 0 而不是 NaN/Infinity', () => {
        expect(performanceRatio(100, 0, 1500)).toBe(0);
        expect(performanceRatio(100, 1000, 0)).toBe(0);
    });
});

describe('自用比例 0–1', () => {
    it('百分数换算并截断', () => {
        expect(normalizeSelfUseRatio(80, 0.7)).toBe(0.8);
        expect(normalizeSelfUseRatio(0, 0.7)).toBe(0);
        expect(normalizeSelfUseRatio(150, 0.7)).toBe(1);
        expect(normalizeSelfUseRatio(-1, 0.7)).toBe(0);
        expect(windSelfUseRatio(80)).toBe(0.8);
        expect(windSelfUseRatio(undefined)).toBe(0.8);
        expect(windSelfUseRatio(0)).toBe(0);
    });

    const input: any = {
        lat: 30, lng: 120, province: '浙江', projectName: 't',
        turbine: { type: 'm', capacity: 2, count: 1, hubHeight: 50, rotorDiameter: 100, cutInSpeed: 3, ratedSpeed: 12, cutOutSpeed: 25 },
        businessModel: { mode: 'self_use_export', feedInTariff: 0.4, electricityPrice: 0.6, selfUseRatio: 0.8 },
        investment: { unitCost: 6000 },
        operation: { availability: 1, wakeLoss: 0, otherLosses: 0 },
    };

    it('风电自用收益 = E×(0.8×0.6 + 0.2×0.4)，传 80 与 0.8 结果一致', async () => {
        const a = await calculateWind(input);
        const b = await calculateWind({ ...input, businessModel: { ...input.businessModel, selfUseRatio: 80 } });
        const e1 = a.energy.year1;
        expect(a.financial.year1Revenue).toBeCloseTo(e1 * (0.8 * 0.6 + 0.2 * 0.4), 6);
        expect(b.financial.year1Revenue).toBeCloseTo(a.financial.year1Revenue, 6);
    });
});

describe('LCOE 折现成本与电量', () => {
    it('I0=1000, 成本 100/年, 电量 1000 kWh/年, r=10%, 2 年 → (1000+173.554)/1735.537', () => {
        const lcoe = discountedLcoe({ initialInvestment: 1000, annualCosts: [100, 100], annualGeneration: [1000, 1000], discountRate: 0.1 });
        const pv = 1 / 1.1 + 1 / 1.21;
        expect(lcoe).toBeCloseTo((1000 + 100 * pv) / (1000 * pv), 10);
        expect(lcoe).toBeCloseTo(0.67619, 4); // 元/kWh
    });
    it('首年不衰减', () => {
        expect(degradationFactor(1, 2, 0.5)).toBe(1);
        expect(degradationFactor(3, 2, 0.5)).toBeCloseTo(0.98 * 0.995, 12);
    });
});

describe('风速外推（对数律，m/s）', () => {
    it('50 m 7 m/s → 100 m：7 × ln(100/0.03)/ln(50/0.03)', () => {
        expect(extrapolateWindSpeed(7, 50, 100)).toBeCloseTo(7 * Math.log(100 / 0.03) / Math.log(50 / 0.03), 12);
        expect(extrapolateWindSpeed(7, 50, 100)).toBeCloseTo(7.6536, 3);
        expect(extrapolateWindSpeed(7, 50, 50)).toBeCloseTo(7, 12);
    });
    it('非法高度/风速返回 0', () => {
        expect(extrapolateWindSpeed(7, 0, 100)).toBe(0);
        expect(extrapolateWindSpeed(-1, 50, 100)).toBe(0);
    });
    // 原断言“月均风速低于切入即发电量为 0”来自旧的常数近似（审计 1-5 指出的缺陷）：
    // 按 Weibull 分布，月均低于切入时仍有部分小时超过切入风速，发电量应很小但不为 0。
    it('容量因子落在 0–1，切入风速越高容量因子越低', async () => {
        const base: any = {
            lat: 30, lng: 120, province: '浙江', projectName: 't',
            turbine: { type: 'm', capacity: 2, count: 1, hubHeight: 50, rotorDiameter: 100, cutInSpeed: 8, ratedSpeed: 12, cutOutSpeed: 25 },
            businessModel: { mode: 'full_export', feedInTariff: 0.4 },
            investment: { unitCost: 6000 },
            operation: { availability: 1, wakeLoss: 0, otherLosses: 0 },
        };
        const high = await calculateWind(base);
        const ok = await calculateWind({ ...base, turbine: { ...base.turbine, cutInSpeed: 3 } });
        expect(ok.energy.capacityFactor).toBeGreaterThan(0);
        expect(ok.energy.capacityFactor).toBeLessThanOrEqual(100);
        expect(high.energy.capacityFactor).toBeLessThan(ok.energy.capacityFactor);
        expect(high.energy.capacityFactor).toBeGreaterThanOrEqual(0);
    });
});
