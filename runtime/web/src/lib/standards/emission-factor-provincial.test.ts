import { resolveEmissionFactor, co2AvoidedKgForProvince, PROVINCIAL_EMISSION_FACTORS_2023, normalizeProvince } from './emission-factor';

describe('审计 8-2 省级排放因子（公告 2025 年第 47 号）', () => {
  it('江苏、云南用例与公告附件手算一致', () => {
    // 1,000,000 kWh × 0.5827 = 582,700 kg；× 0.1333 = 133,300 kg
    expect(co2AvoidedKgForProvince(1_000_000, '江苏省')).toBeCloseTo(582_700, 6);
    expect(co2AvoidedKgForProvince(1_000_000, '云南')).toBeCloseTo(133_300, 6);
  });
  it('收录 30 个省级因子，规范化省名后缀', () => {
    expect(Object.keys(PROVINCIAL_EMISSION_FACTORS_2023)).toHaveLength(30);
    expect(normalizeProvince('新疆维吾尔自治区')).toBe('新疆');
    expect(normalizeProvince('广西壮族自治区')).toBe('广西');
    expect(resolveEmissionFactor('北京市').value).toBe(0.5554);
  });
  it('无省份或公告未收录时回落全国平均并说明口径', () => {
    expect(resolveEmissionFactor().value).toBe(0.5306);
    const tibet = resolveEmissionFactor('西藏自治区');
    expect(tibet.value).toBe(0.5306);
    expect(tibet.scope).toContain('未收录西藏');
  });
});
