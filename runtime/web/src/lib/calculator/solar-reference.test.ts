import fixture from './__fixtures__/calc_reference.json';
import { MODULE_GAMMA_PER_C, gb50797AnnualEnergyKWh, referenceMonthlyEnergyKWh, temperatureFactor } from './solar';

describe('光伏参考夹具', () => {
    it('温度系数落在晶硅典型区间，冷热两个方向都修正', () => {
        expect(MODULE_GAMMA_PER_C).toBeGreaterThanOrEqual(-0.004);
        expect(MODULE_GAMMA_PER_C).toBeLessThanOrEqual(-0.0029);
        expect(temperatureFactor(15)).toBeGreaterThan(1);
        expect(temperatureFactor(35)).toBeLessThan(1);
    });

    it('月尺度模型与夹具中的 pvlib 年发电量相差不超过 3%', () => {
        for (const row of fixture.solar) {
            const model = referenceMonthlyEnergyKWh(
                row.monthly_poa_kwh_m2,
                row.monthly_cell_c,
                row.capacity_kw,
                row.gamma_per_c,
                row.losses,
                row.inverter,
            );
            expect(Math.abs(model - row.pvlib_annual_kwh) / row.pvlib_annual_kwh).toBeLessThanOrEqual(0.03);
        }
    });

    it('GB 50797 年发电量就是辐照乘容量乘综合效率', () => {
        expect(gb50797AnnualEnergyKWh(1500, 100, 0.8)).toBe(120000);
    });
});
