/**
 * 光伏测算手算基准。每个用例都写明手算过程；引擎结果与手算偏差超过 ±2% 即失败。
 * 资源数据用固定值 mock，避免依赖网络。
 */
import { calculateSolar, annualEnergyKWh, performanceRatio, LOSS_ASSUMPTIONS, normalizeSelfUseRatio, degradationFactor, defaultUnitCost, DEFAULT_SYSTEM_COST_PER_KW } from './solar';
import { discountedLcoe } from './project-finance';
import { SolarCalculationInput } from '@/types';

const daysIn2024 = (month: number) => new Date(2024, month, 0).getDate();

// 每月水平面辐照固定 125 kWh/m² → 全年 1500 kWh/m²；气温 0°C → 组件温度 20°C < 25°C，不计温度损失。
// 基准用水平安装（倾角 0°），此时组件平面辐照严格等于水平面辐照，手算不依赖换算模型。
// （此前用倾角 30° 也得到 POA = GHI，是旧算法「最佳倾角不增益」的缺陷，见 transposition.ts。）
// 统一光伏模型的资源数据入口（原先 mock 的是 nasa-power.getSolarResource，测算已改为从 solar-resource 取数）
jest.mock('@/lib/calculator/solar-resource', () => ({
    loadSolarResource: jest.fn(async () => ({
        annual: { ghi: 1500, peakSunHours: 1500, optimalTilt: 30, resourceClass: 'III' },
        monthly: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            ghi: 125 / new Date(2024, i + 1, 0).getDate(),
            dni: 0, dhi: 0,
            temperature: 0,
        })),
    })),
}));
jest.mock('@/lib/policy/electricity-price', () => ({
    getPriceConfig: jest.fn(() => ({ retailPrice: 0.6, feedInTariff: 0.35 })),
}));
jest.mock('@/lib/services/policy-service', () => ({
    PolicyService: { getActivePolicies: jest.fn(async () => []) },
}));

function expectWithin2Percent(actual: number, expected: number) {
    expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(0.02);
}

const benchmarkInput: SolarCalculationInput = {
    lat: 30, lng: 120, capacity: 1000, installationType: 'ground', moduleType: 'standard',
    tilt: 0, azimuth: 180, selfUseRatio: 0, electricityPrice: 0.6, feedInTariff: 0.35,
    unitCost: 3500, province: '浙江',
};

describe('手算基准：发电量与 PR', () => {
    it('1000 kW × 倾斜面年辐照 1500 kWh/m² × 系统效率 0.8 = 1,200,000 kWh，PR = 0.8', () => {
        // 手算：1000 kW × (1500 kWh/m² ÷ 1 kW/m²) × 0.8 = 1,200,000 kWh
        const energy = annualEnergyKWh(1000, 1500, 0.8);
        expectWithin2Percent(energy, 1_200_000);
        // 手算：PR = 1,200,000 ÷ (1000 × 1500 ÷ 1) = 0.8
        expectWithin2Percent(performanceRatio(energy, 1000, 1500), 0.8);
    });

    it('引擎端到端：地面电站 1000 kW、组件平面 1500 kWh/m²、低温，发电量与 PR 与手算一致', async () => {
        const result = await calculateSolar(benchmarkInput);
        // 手算系统效率（地面）：遮挡 0.99 × 失配 0.98 × 直流线损 0.985 × 逆变器 0.97
        //   × 灰尘 (1-0.02) × 交流及升压 (1-0.015) = 0.8948
        const eta = 0.99 * 0.98 * 0.985 * 0.97 * (1 - LOSS_ASSUMPTIONS.soilingLoss) * (1 - LOSS_ASSUMPTIONS.acLoss);
        expect(eta).toBeCloseTo(0.8948, 4);
        // 手算年发电量：1000 × 1500 × 0.8948 ≈ 1,342,200 kWh
        expectWithin2Percent(result.energy.year1, 1_342_200);
        expectWithin2Percent(result.energy.planeIrradiation!, 1500);
        // 手算 PR：1,342,200 ÷ (1000 × 1500) ≈ 0.8948
        expectWithin2Percent(result.energy.pr, 0.8948);
        expect(daysIn2024(2)).toBe(29); // 引擎按 2024 年天数折算月辐照，mock 已按同一天数构造
    });
});

describe('自用比例口径：0–1 小数', () => {
    it('自用比例 0.8 时，自用电量 = 首年发电量的 80%，首年收益按 80/20 拆分', async () => {
        const result = await calculateSolar({ ...benchmarkInput, selfUseRatio: 0.8 });
        const e1 = result.energy.year1;
        expect(result.financial.selfUseEnergy! / e1).toBeCloseTo(0.8, 10);
        expect(result.financial.exportEnergy! / e1).toBeCloseTo(0.2, 10);
        // 手算：首年收益 = E × (0.8 × 0.6 元 + 0.2 × 0.35 元) = E × 0.55 元/kWh
        expectWithin2Percent(result.financial.year1Revenue, e1 * 0.55);
    });

    it('引擎拒收百分数（80），不再静默当成 0.8% 处理', async () => {
        await expect(calculateSolar({ ...benchmarkInput, selfUseRatio: 80 })).rejects.toThrow('自用比例');
    });

    it('接口层换算：80 → 0.8、0.8 → 0.8、缺省取默认值、越界截断', () => {
        expect(normalizeSelfUseRatio(80, 0)).toBeCloseTo(0.8, 10);
        expect(normalizeSelfUseRatio('80', 0)).toBeCloseTo(0.8, 10);
        expect(normalizeSelfUseRatio(0.8, 0)).toBeCloseTo(0.8, 10);
        expect(normalizeSelfUseRatio(undefined, 0.7)).toBe(0.7);
        expect(normalizeSelfUseRatio(150, 0)).toBe(1);
        expect(normalizeSelfUseRatio(-3, 0)).toBe(0);
    });
});

describe('手算基准：LCOE 折现口径', () => {
    it('固定参数：投资 350 万、运维 3.5 万/年、发电 120 万 kWh/年、r=8%、25 年 → 0.3024 元/kWh', () => {
        // 手算：年金系数 A = (1 − 1.08^−25) ÷ 0.08 = 10.6748
        //   分子 = 3,500,000 + 35,000 × 10.6748 = 3,873,617
        //   分母 = 1,200,000 × 10.6748 = 12,809,731
        //   LCOE = 3,873,617 ÷ 12,809,731 = 0.3024 元/kWh
        // 不折现的错误口径 = (3,500,000 + 875,000) ÷ 30,000,000 = 0.1458，只有一半
        const lcoe = discountedLcoe({
            initialInvestment: 3_500_000,
            annualCosts: Array(25).fill(35_000),
            annualGeneration: Array(25).fill(1_200_000),
            discountRate: 0.08,
        });
        expectWithin2Percent(lcoe, 0.3024);
        expect(lcoe).toBeGreaterThan(0.1458 * 1.5);
    });

    it('引擎端到端：地面 1000 kW、3500 元/kW，LCOE 与手算一致', async () => {
        const result = await calculateSolar(benchmarkInput);
        // 手算：投资 I0 = 1000 × 3500 = 3,500,000 元
        //   运维现值 = 35,000 × Σ 1.02^(t−1)/1.08^t = 35,000 × (1/1.08) × (1 − (1.02/1.08)^25)/(1 − 1.02/1.08)
        //            = 35,000 × 12.674 = 443,591
        //   发电现值（标准组件：首年衰减 1.5%，此后 0.45%/年）
        //            = E1 × [1/1.08 + 0.985/1.08² × Σ_{k=0}^{23} (0.9955/1.08)^k] = E1 × 10.1917
        //            = 1,342,212 × 10.1917 ≈ 13,679,500
        //   LCOE = (3,500,000 + 443,591) ÷ 13,679,500 ≈ 0.2883 元/kWh
        expectWithin2Percent(result.financial.lcoe, 0.2883);
        expect(result.assumptions).toMatchObject({ discountRate: 0.08, firstYearDegradation: 1.5, annualDegradation: 0.45 });
    });

    it('逐年发电量、现金流使用同一衰减：第 2 年 = 首年 × 0.985，第 3 年再 × 0.9955', async () => {
        const result = await calculateSolar({ ...benchmarkInput, selfUseRatio: 1 });
        const rev = result.financial.revenue!;
        expect(rev[1] / rev[0]).toBeCloseTo(0.985, 3);
        expect(rev[2] / rev[1]).toBeCloseTo(0.9955, 3);
        expect(degradationFactor(1, 1.5, 0.45)).toBe(1);
    });
});

describe('碳减排：统一排放因子', () => {
    it('首年减排 = 首年发电量 × 0.5306 kg/kWh，结果带因子年份与来源', async () => {
        const result = await calculateSolar(benchmarkInput);
        // 手算：1,342,212 kWh × 0.5306 ≈ 712,178 kg
        expectWithin2Percent(result.environmental.co2Year1, 712_178);
        expect(result.environmental.emissionFactorYear).toBe(2023);
        expect(result.environmental.emissionFactorSource).toContain('2025 年第 47 号');
    });
});

describe('不填单位投资时的默认系统造价', () => {
    it('标准组件 3,000 元/kW（含安装并网的全部初始投资），经济型 / 高效组件按组件单价差额浮动，不再是只够买组件的 1,500 元/kW', () => {
        expect(DEFAULT_SYSTEM_COST_PER_KW).toBe(3000);
        expect(defaultUnitCost('standard')).toBe(3000);
        expect(defaultUnitCost('economy')).toBe(2850);
        expect(defaultUnitCost('premium')).toBe(3200);
    });
});
