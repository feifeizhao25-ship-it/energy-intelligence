import { GRID_EMISSION_FACTOR, PROVINCIAL_EMISSION_FACTORS_2023 } from '@/lib/standards/emission-factor';
import { estimateGridEmission, GRID_FACTOR_TCO2_PER_MWH } from './carbon-factor';

it('1000 兆瓦时、未填省份，用手算的全国平均吨数，并标明是全国因子', () => {
  const result = estimateGridEmission(1000);
  // 1,000 MWh × 0.5306 tCO2/MWh = 530.6 t
  expect(result.tonnesCo2).toBeCloseTo(1000 * GRID_EMISSION_FACTOR.value, 6);
  expect(result.tonnesCo2).toBeCloseTo(530.6, 6);
  expect(result.factor).toBe(GRID_FACTOR_TCO2_PER_MWH);
  expect(result.province).toBeNull();
  expect(result.scope).toContain('全国');
  expect(result.assumptions[0]).toContain('全国电力平均二氧化碳排放因子');
  expect(result.ccerRevenueCny).toBeNull();
  expect(result.sourceUrl).toMatch(/^https:\/\/www\.mee\.gov\.cn\//);
});

it('已知省份用手算的表 3 因子，不回落到全国平均', () => {
  const jiangsu = estimateGridEmission(1000, '江苏省');
  // 1,000 MWh × 0.5827 = 582.7 t
  expect(jiangsu.factor).toBe(PROVINCIAL_EMISSION_FACTORS_2023['江苏']);
  expect(jiangsu.tonnesCo2).toBeCloseTo(582.7, 6);
  expect(jiangsu.province).toBe('江苏');
  expect(jiangsu.scope).toBe('江苏省级电力平均二氧化碳排放因子');
  expect(jiangsu.assumptions[0]).toContain('江苏省级');
  expect(jiangsu.assumptions[0]).not.toContain('全国电力平均');

  const yunnan = estimateGridEmission(1000, '云南');
  // 1,000 MWh × 0.1333 = 133.3 t
  expect(yunnan.tonnesCo2).toBeCloseTo(133.3, 6);
  expect(yunnan.scope).toContain('云南');
});

it('公告未收录的省份标明回落全国平均', () => {
  const tibet = estimateGridEmission(1000, '西藏自治区');
  expect(tibet.tonnesCo2).toBeCloseTo(530.6, 6);
  expect(tibet.province).toBeNull();
  expect(tibet.scope).toContain('未收录西藏');
});
