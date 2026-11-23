/** 43 + 核20：样本改用 NASA POWER 气候态；插值点年总量 = Σ 日均 × 当月天数。 */
import seed from '@/data/domestic-resources.json';
import { resolveDomesticStation } from './domestic-station';

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

describe('国内省会样本（NASA POWER 气候态）', () => {
  it('来源与偏差写明', () => {
    expect(seed.license_note).toMatch(/NASA POWER/);
    expect(seed.license_note).toMatch(/不是地面气象站实测/);
    expect((seed as any).source.period).toBe('2001–2025');
  });
  it('插值点年总量按天数加权，不是 12 个日均值相加（核20）', () => {
    const s = resolveDomesticStation(38.5, 115.5)!; // 北京与石家庄之间
    expect(s.interpolated).toBe(true);
    const expected = s.monthly_daily_ghi.reduce((sum, v, i) => sum + v * DAYS[i], 0);
    expect(s.ghi_annual).toBeCloseTo(expected, 6);
    expect(s.ghi_annual).toBeGreaterThan(1000);
    expect(s.license_note).toMatch(/不是该点的 NASA POWER 网格值/);
  });
});
