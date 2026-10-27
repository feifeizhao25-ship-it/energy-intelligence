import { GRID_EMISSION_FACTOR } from '@/lib/standards/emission-factor';
import { estimateGridEmission, GRID_FACTOR_TCO2_PER_MWH } from './carbon-factor';

it('1000 兆瓦时对应全站因子的吨数，且不给额外收益金额', () => {
  const result = estimateGridEmission(1000);
  expect(result.tonnesCo2).toBeCloseTo(1000 * GRID_EMISSION_FACTOR.value);
  expect(result.factor).toBe(GRID_FACTOR_TCO2_PER_MWH);
  expect(result.ccerRevenueCny).toBeNull();
  expect(result.sourceUrl).toMatch(/^https:\/\/www\.mee\.gov\.cn\//);
});
