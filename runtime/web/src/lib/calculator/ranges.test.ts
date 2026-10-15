import { proportionalRange, inverseRange, formatRange, uncertaintySection, SOLAR_GENERATION_REL_UNCERTAINTY } from './ranges';

describe('审计 3-2 区间 + 中值', () => {
  it('合成不确定度 ≈ ±5.8%', () => {
    expect(SOLAR_GENERATION_REL_UNCERTAINTY).toBeCloseTo(0.0583, 3);
  });
  it('万度格式：约 a–b 万度（中值 m 万）', () => {
    expect(formatRange(proportionalRange(1_180_000), '度')).toBe('约 111–125 万度（中值 118 万）');
  });
  it('小数值保留原单位', () => {
    expect(formatRange(proportionalRange(1000), 'kg')).toBe('约 942–1,058 kg（中值 1,000）');
  });
  it('回收期反向：发电偏低时回收期变长', () => {
    const r = inverseRange(6);
    expect(r.high).toBeGreaterThan(6);
    expect(r.low).toBeLessThan(6);
  });
  it('不确定性小节自动生成并声明非承诺', () => {
    const s = uncertaintySection([{ label: '首年发电量', range: proportionalRange(50_000), unit: 'kWh' }]);
    expect(s[0]).toContain('首年发电量：约');
    expect(s.join('')).toContain('不构成收益承诺');
  });
});
