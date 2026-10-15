/**
 * 1-4：IRR 与 numpy-financial 外部基准一致；无唯一解返回 null；储能循环次数取自配置。
 * 基准由 numpy-financial 1.1.0 npf.irr 生成（seed 20261015），见 __fixtures__/irr_oracle_numpy_financial.json。
 */
import oracle from './__fixtures__/irr_oracle_numpy_financial.json';
import { solveIrr } from './project-finance';
import { calculateStorage } from './storage';

describe('IRR 对 numpy-financial', () => {
  it.each(oracle.cases.map((c, i) => [i, c] as const))('case %i', (_i, c) => {
    const r = solveIrr(c.cashFlows);
    expect(r).not.toBeNull();
    expect(Math.abs((r as number) - c.irr)).toBeLessThan(1e-6);
  });
  it('多次变号或不变号 → null（numpy 会给其中一个根，这里不伪造唯一值）', () => {
    for (const flows of oracle.noUniqueIrr) expect(solveIrr(flows)).toBeNull();
  });
});

const base = {
  energy: 1000, power: 500, applicationMode: 'arbitrage',
  arbitrageConfig: { peakPrice: 1.0, valleyPrice: 0.3, flatPrice: 0.6, chargeTime1: [0, 6], dischargeTime1: [8, 11] },
  investment: { unitCost: 1200, financing: 'cash' },
  technical: { efficiency: 81, dod: 90, cycleLife: 6000, degradationRate: 2, maintenanceCostRatio: 1 },
} as any;

describe('储能：循环次数取自配置', () => {
  it('一充一放：年放电量 = 可用容量 × 单程效率 × 1 × 330（手算）', async () => {
    const r: any = await calculateStorage(base);
    expect(r.technical.dailyCycles).toBe(1);
    // 1000 × 0.9 × √0.81(=0.9) × 1 × 330 = 267,300 kWh（第 1 年无衰减）
    const firstYearDischarge = 1000 * 0.9 * 0.9 * 330;
    expect(firstYearDischarge).toBeCloseTo(267300, 6);
    expect(r.assumptions.join('|')).toContain('每日循环 1 次');
  });
  it('配置第二段充电 → 两充两放，日收益含第二次循环', async () => {
    const one: any = await calculateStorage(base);
    const two: any = await calculateStorage({ ...base, arbitrageConfig: { ...base.arbitrageConfig, chargeTime2: [12, 14], dischargeTime2: [18, 20] } });
    expect(two.technical.dailyCycles).toBe(2);
    expect(two.financial.metrics.dailyRevenue).toBeGreaterThan(one.financial.metrics.dailyRevenue);
    // 两次循环放电量翻倍 → 度电储能成本减半（其余相同）
    expect(two.financial.metrics.lcos).toBeCloseTo(one.financial.metrics.lcos / 2, 6);
  });
  it('年运行天数可配置', async () => {
    const r: any = await calculateStorage({ ...base, technical: { ...base.technical, operatingDaysPerYear: 300 } });
    expect(r.technical.operatingDays).toBe(300);
    expect(r.financial.metrics.annualRevenue).toBeCloseTo(r.financial.metrics.dailyRevenue * 300, 6);
  });
});
