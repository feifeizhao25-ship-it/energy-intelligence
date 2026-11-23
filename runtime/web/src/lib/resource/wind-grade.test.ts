import { gbt18710Grade, windPowerDensityFromMonthlyMeans, RAYLEIGH_CUBE_FACTOR } from '@/lib/resource/wind-grade';
import { getWindResource } from '@/lib/api/nasa-power';
import { extrapolateWindSpeed } from '@/lib/calculator/wind-shear';

describe('GB/T 18710-2002 风功率密度与等级（核1）', () => {
  it('6.5 m/s：约 321 W/m²，表 4 第 3 级（原来用均值立方是 168 W/m²）', () => {
    const w = windPowerDensityFromMonthlyMeans(Array(12).fill(6.5));
    expect(w).toBeCloseTo(0.5 * 1.225 * RAYLEIGH_CUBE_FACTOR * 6.5 ** 3, 6);
    expect(w).toBeCloseTo(321.3, 0);
    expect(gbt18710Grade(w)).toEqual({ grade: 3, label: '3 级（较好）' });
  });
  it.each([[150, 1], [200, 2], [399, 3], [400, 4], [500, 5], [600, 6], [800, 7], [5000, 7]])('%p W/m² → %p 级', (w, g) => {
    expect(gbt18710Grade(w as number).grade).toBe(g);
  });
  it('省会样本的 100 m 风速先换回 50 m 再分级，不再把 100 m 当 50 m 重复外推', async () => {
    const r = await getWindResource(39.9, 116.41); // 北京样本
    for (const m of r.monthly) expect(m.speed100m).toBeCloseTo(extrapolateWindSpeed(m.speed50m, 50, 100), 6);
    expect(r.annual.gbGrade).toBeGreaterThanOrEqual(1);
    expect(r.annual.powerDensity50m).toBeLessThan(r.annual.powerDensity);
    expect(r.annual.gbGradeLabel).toMatch(/级/);
  });
});
