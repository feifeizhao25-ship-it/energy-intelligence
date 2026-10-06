/**
 * 光伏测算手算基准。每个用例都写明手算过程；引擎结果与手算偏差超过 ±2% 即失败。
 * 资源数据用固定值 mock，避免依赖网络。
 */
import { calculateSolar, annualEnergyKWh, performanceRatio, LOSS_ASSUMPTIONS, normalizeSelfUseRatio } from './solar';
import { SolarCalculationInput } from '@/types';

const daysIn2024 = (month: number) => new Date(2024, month, 0).getDate();

// 每月组件平面辐照固定 125 kWh/m² → 全年 1500 kWh/m²；气温 0°C → 组件温度 20°C < 25°C，不计温度损失。
jest.mock('@/lib/api/nasa-power', () => ({
    getSolarResource: jest.fn(async () => ({
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
    tilt: 30, azimuth: 180, selfUseRatio: 0, electricityPrice: 0.6, feedInTariff: 0.35,
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
