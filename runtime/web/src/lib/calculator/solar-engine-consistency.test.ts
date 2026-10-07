/**
 * 光伏只有一套模型：快速测算（calculateSolar）、带证据链的初步估算（SolarCalculatorV2）、
 * NREL 未配置时的估算兜底（calculateSolarOutput）对同一地点、同一参数必须给出同一结果。
 *
 * 此前 v2 用「水平面年辐照 × 固定综合效率 0.8」、快速测算用分项损耗 + 温度修正，同一地点差约 2.7%；
 * 两边还各取不同年份的资源数据（2022 年 vs 上一完整年）。
 * 网络只 mock 到 fetch 这一层，两条路径都走真实的 verifiedSolar 校验与换算。
 */
jest.mock('@/lib/services/policy-service', () => ({
    PolicyService: { getActivePolicies: jest.fn(async () => []) },
}));

import { calculateSolar, simulateSolar } from './solar';
import { SolarCalculatorV2 } from './solar-v2';
import { calculateSolarOutput } from '@/lib/api/nrel';

const YEAR = new Date().getUTCFullYear() - 1;
const DAYS_IN_YEAR = new Date(Date.UTC(YEAR, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
const LAT = 32.06;
const LNG = 118.79;

/** 每月日均水平面辐照 4 kWh/m²、月均气温 15°C 的 NASA POWER 应答 */
function nasaFixture() {
    const months = (value: number) => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(YEAR) + String(i + 1).padStart(2, '0'), value]));
    return {
        geometry: { coordinates: [LNG, LAT] },
        parameters: { ALLSKY_SFC_SW_DWN: { units: 'kW-hr/m^2/day' }, T2M: { units: 'C' } },
        header: { fill_value: -999, start: `${YEAR}0101`, end: `${YEAR}1231`, time_standard: 'UTC' },
        properties: { parameter: { ALLSKY_SFC_SW_DWN: months(4), T2M: months(15) } },
    };
}

beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify(nasaFixture())));
});
afterEach(() => jest.restoreAllMocks());

function within(actual: number, expected: number, tolerance: number) {
    expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(tolerance);
}

describe('同一输入同一结果', () => {
    it('v2 初步估算与快速测算：发电量、月度、PR、IRR、NPV、LCOE、回收期完全一致', async () => {
        // v2：100 kW、3.5 元/W、每度电 0.6 元（屋顶、标准组件、最佳倾角、正南，全部电量同价）
        const v2 = await SolarCalculatorV2.calculate({ location: { lat: LAT, lng: LNG }, capacity: 100, unitCost: 3.5, electricityPrice: 0.6 });
        const quick = await calculateSolar({
            lat: LAT, lng: LNG, capacity: 100, installationType: 'roof', moduleType: 'standard',
            selfUseRatio: 1, electricityPrice: 0.6, feedInTariff: 0.6, unitCost: 3500, province: '江苏',
        });
        expect(v2.result.annualGeneration).toBe(quick.energy.year1);
        expect(v2.result.monthlyGeneration).toEqual(quick.energy.monthly);
        expect(v2.result.totalGeneration).toBe(quick.energy.lifetime);
        expect(v2.assumptions.performanceRatio).toBe(quick.energy.pr);
        expect(v2.result.npv).toBe(quick.financial.npv);
        expect(v2.result.lcoe).toBe(quick.financial.lcoe);
        expect(v2.result.irr).not.toBeNull();
        expect(v2.result.irr!).toBeCloseTo(quick.financial.irr, 8);
        expect(v2.result.paybackPeriod!).toBeCloseTo(quick.financial.paybackYears, 8);
        expect(v2.result.initialInvestment).toBe(quick.financial.investment);
        // 逐年现金流表与引擎一致：第 2 年发电量 = 首年 × (1 − 首年衰减 1.5%)
        expect(v2.result.cashFlow[0].netCashFlow).toBe(quick.financial.cashFlow[0]);
        expect(v2.result.cashFlow[1].generation / v2.result.cashFlow[0].generation).toBeCloseTo(0.985, 3);
    });

    it('NREL 兜底估算与快速测算（地面、标准组件）首年发电量与月度一致', async () => {
        const fallback = await calculateSolarOutput(LAT, LNG, 100, 0.6);
        const quick = await calculateSolar({
            lat: LAT, lng: LNG, capacity: 100, installationType: 'ground', moduleType: 'standard',
            selfUseRatio: 1, electricityPrice: 0.6, feedInTariff: 0.6, province: '江苏',
        });
        expect(fallback.annualEnergyKwh).toBe(Math.round(quick.energy.year1));
        expect(fallback.monthlyEnergyKwh).toEqual(quick.energy.monthly);
        expect(fallback.performanceRatio).toBeCloseTo(quick.energy.pr, 4);
    });

    it('同一资源数据重复计算结果不变（纯函数）', async () => {
        const v2a = await SolarCalculatorV2.calculate({ location: { lat: LAT, lng: LNG }, capacity: 250, unitCost: 3.2, electricityPrice: 0.55 });
        const v2b = await SolarCalculatorV2.calculate({ location: { lat: LAT, lng: LNG }, capacity: 250, unitCost: 3.2, electricityPrice: 0.55 });
        expect(v2a.result).toEqual(v2b.result);
    });
});

describe('手算基准（统一模型）', () => {
    it('屋顶 100 kW、日均 4 kWh/m²、气温 15°C：首年发电量与 PR 与手算一致', async () => {
        // 手算（全年 365 天时）：
        //   水平面年辐照 = 4 × 365 = 1460 kWh/m²；最佳倾角、正南 → 倾角/方位修正都为 1，组件平面年辐照 = 1460
        //   屋顶系统效率 = 遮挡 0.97 × 失配 0.98 × 直流线损 0.985 × 逆变器 0.96 × 灰尘 0.98 × 交流及升压 0.985 = 0.86770
        //   组件温度 = 15 + 20 = 35°C → 温度修正 = 1 − (35 − 25) × 0.4% = 0.96
        //   首年发电量 = 100 kW × 1460 kWh/m² ÷ 1 kW/m² × 0.86770 × 0.96 ≈ 121,616 kWh
        //   PR = 121,616 ÷ (100 × 1460) ≈ 0.8330
        //   旧 v2 口径：100 × 1460 × 0.8 = 116,800 kWh，比统一模型低约 4%（本例气温较低时差距更小）
        const eta = 0.97 * 0.98 * 0.985 * 0.96 * 0.98 * 0.985;
        expect(eta).toBeCloseTo(0.86770, 4);
        const expected = 100 * 4 * DAYS_IN_YEAR * eta * 0.96;
        if (DAYS_IN_YEAR === 365) within(expected, 121_616, 0.0005);
        const v2 = await SolarCalculatorV2.calculate({ location: { lat: LAT, lng: LNG }, capacity: 100, unitCost: 3.5, electricityPrice: 0.6 });
        within(v2.result.annualGeneration, expected, 0.001); // 逐月取整造成的差异 < 0.1%
        within(v2.assumptions.performanceRatio, 0.8330, 0.001);
        within(v2.result.planeIrradiation!, 4 * DAYS_IN_YEAR, 1e-9);
    });

    it('simulateSolar 直接调用：资源与参数相同则结果相同，不联网', () => {
        const resource = {
            monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ghi: 4, temperature: 15, days: 30 })),
            annual: { ghi: 1440, peakSunHours: 1440, optimalTilt: 42, resourceClass: 'III' as const },
        };
        const params = { capacity: 100, installationType: 'roof' as const, moduleType: 'standard' as const,
            selfUsePrice: 0.6, feedInPrice: 0.6, selfUseRatio: 1, unitCost: 3500 };
        expect(simulateSolar(resource, params)).toEqual(simulateSolar(resource, params));
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
