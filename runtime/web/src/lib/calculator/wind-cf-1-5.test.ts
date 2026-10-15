import { estimateCapacityFactor, airDensityAt, genericPowerCurve, STANDARD_AIR_DENSITY } from './wind';

describe('审计 1-5 风电容量系数', () => {
  it('阶跃功率曲线的积分等于 Weibull 解析超越概率 exp(-(x/c)^k)', () => {
    for (const k of [1.6, 2, 2.6]) {
      const vAvg = 7;
      // c = vAvg / Γ(1+1/k)，取 Γ 的已知值
      const gammaVals: Record<number, number> = { 1.6: 0.89657, 2: 0.886227, 2.6: 0.888178 };
      const c = vAvg / gammaVals[k];
      const cf = estimateCapacityFactor(vAvg, 0, 0, 100, { weibullK: k, powerCurve: (v) => (v >= 9 ? 1 : 0) });
      expect(cf).toBeCloseTo(Math.exp(-Math.pow(9 / c, k)), 2);
    }
  });
  it('空气密度按海拔下降，高海拔容量因子更低', () => {
    expect(airDensityAt(0, 15)).toBeCloseTo(STANDARD_AIR_DENSITY, 6);
    expect(airDensityAt(3000, 15)).toBeCloseTo(0.86, 2);
    const sea = estimateCapacityFactor(7, 3, 12, 25);
    const high = estimateCapacityFactor(7, 3, 12, 25, { airDensity: airDensityAt(3000, 5) });
    expect(high).toBeLessThan(sea);
  });
  it('通用功率曲线：切入前 0、额定后满发、切出后 0，且不再乘常数 0.45', () => {
    expect(genericPowerCurve(2, 3, 12, 25)).toBe(0);
    expect(genericPowerCurve(13, 3, 12, 25)).toBe(1);
    expect(genericPowerCurve(26, 3, 12, 25)).toBe(0);
    expect(genericPowerCurve(7.5, 3, 12, 25)).toBeCloseTo((7.5 ** 3 - 27) / (1728 - 27), 6);
  });
  it('典型 7 m/s 场址容量因子落在合理区间', () => {
    const cf = estimateCapacityFactor(7, 3, 11, 25);
    expect(cf).toBeGreaterThan(0.2);
    expect(cf).toBeLessThan(0.45);
  });
});
