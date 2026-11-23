/**
 * GB/T 18710-2002《风电场风能资源评估方法》：附录 B 风功率密度、表 4 风功率密度等级（50 m）。
 * 与后端 app/services/wind_grade_gbt18710.py 同一口径。
 */
export const RAYLEIGH_CUBE_FACTOR = 6 / Math.PI; // Γ(1+3/k)/Γ(1+1/k)^3，k=2

/** 只有月平均风速时：每月按瑞利分布求 v³ 期望，再取平均。不是用年平均风速直接立方。 */
export function windPowerDensityFromMonthlyMeans(monthlyMeans: number[], airDensity = 1.225): number {
  const vs = monthlyMeans.filter(v => Number.isFinite(v) && v >= 0);
  if (!vs.length) return 0;
  return 0.5 * airDensity * vs.reduce((sum, v) => sum + RAYLEIGH_CUBE_FACTOR * v ** 3, 0) / vs.length;
}

const TABLE4_50M: Array<[number, number, string]> = [
  [800, 7, '很好'], [600, 6, '很好'], [500, 5, '很好'], [400, 4, '好'], [300, 3, '较好'], [200, 2, '表4未标注并网适用'], [0, 1, '表4未标注并网适用'],
];

/** 按 50 m 风功率密度查表 4，得 1–7 级（7 级最好）。 */
export function gbt18710Grade(powerDensity50m: number): { grade: number; label: string } {
  const w = Math.max(0, powerDensity50m || 0);
  const row = TABLE4_50M.find(([low]) => w >= low) ?? TABLE4_50M[TABLE4_50M.length - 1];
  return { grade: row[1], label: `${row[1]} 级（${row[2]}）` };
}
