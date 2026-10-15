import { irrRange, levelizedCostRange, formatPercentRange, WIND_GENERATION_REL_UNCERTAINTY } from './ranges';
import { solveIrr } from './project-finance';
import { calculateStorage } from './storage';

describe('审计 3-2 IRR / LCOE 区间', () => {
  const inv = 1000;
  const rev = Array(20).fill(150);
  const cost = Array(20).fill(20);
  const median = solveIrr([-inv, ...rev.map((r, i) => r - cost[i])])! * 100;

  it('IRR 区间：收入下浮时 IRR 下降，上浮时上升，中值不变', () => {
    const r = irrRange(inv, rev, cost, median, 0.1, 'x');
    expect(r.low!).toBeLessThan(median);
    expect(r.high!).toBeGreaterThan(median);
    expect(r.median).toBe(median);
    // 手算校验下端：收入 ×0.9
    expect(r.low!).toBeCloseTo(solveIrr([-inv, ...rev.map((x, i) => x * 0.9 - cost[i])])! * 100, 8);
  });
  it('收入下浮到亏损时下端为 null（无唯一解），格式化写“无解”', () => {
    const r = irrRange(1000, Array(5).fill(30), Array(5).fill(25), 1, 0.5, 'x');
    expect(r.low).toBeNull();
    expect(formatPercentRange(r)).toContain('无解');
    expect(formatPercentRange({ ...r, median: null })).toBe('无唯一解');
  });
  it('LCOE 与发电量成反比', () => {
    const l = levelizedCostRange(0.3, WIND_GENERATION_REL_UNCERTAINTY, 'x');
    expect(l.high).toBeCloseTo(0.3 / 0.85, 10);
    expect(l.low).toBeCloseTo(0.3 / 1.15, 10);
  });
  it('储能结果带 annualRevenue / irr / lcos 区间', async () => {
    const r: any = await calculateStorage({
      energy: 1000, power: 500, applicationMode: 'arbitrage',
      arbitrageConfig: { peakPrice: 1.1, valleyPrice: 0.3, flatPrice: 0.6 },
      technical: { dod: 90, efficiency: 88, degradationRate: 2, maintenanceCostRatio: 1.5, cycleLife: 6000 },
      investment: { unitCost: 1200 },
    } as any);
    expect(r.ranges.annualRevenue.low).toBeLessThan(r.ranges.annualRevenue.high);
    expect(r.ranges.lcos.high).toBeGreaterThan(r.financial.metrics.lcos);
    expect(r.ranges.irr.median).toBe(r.financial.metrics.irr);
  });
});
