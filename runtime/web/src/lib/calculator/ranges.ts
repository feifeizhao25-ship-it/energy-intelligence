import { solveIrr } from './project-finance';

/**
 * 审计 3-2：对外数字统一用“区间 + 中值”，避免单点数字被理解为承诺。
 *
 * 光伏年发电量区间来源（均为假设，写进结果说明）：
 * - 年际辐照波动：±5%（单一年份 NASA POWER 辐照与多年平均的典型偏差）
 * - 系统损耗假设：±3%（遮挡、灰尘、温度、逆变器效率等的取值不确定）
 * 两者视为独立，合成 ±√(5²+3²) ≈ ±5.8%。
 */
export const SOLAR_INTERANNUAL_VARIATION = 0.05;
export const SOLAR_LOSS_ASSUMPTION_VARIATION = 0.03;
export const SOLAR_GENERATION_REL_UNCERTAINTY = Math.sqrt(
  SOLAR_INTERANNUAL_VARIATION ** 2 + SOLAR_LOSS_ASSUMPTION_VARIATION ** 2,
);
export const SOLAR_RANGE_NOTE =
  `区间来自年际辐照波动（±${SOLAR_INTERANNUAL_VARIATION * 100}%）与损耗假设（±${SOLAR_LOSS_ASSUMPTION_VARIATION * 100}%）合成，约 ±${(SOLAR_GENERATION_REL_UNCERTAINTY * 100).toFixed(1)}%`;

export type ValueRange = {
  low: number;
  median: number;
  high: number;
  relUncertainty: number;
  note: string;
}

/** 与发电量同比例变化的量（发电量、收入、减碳）：median × (1 ± u) */
export function proportionalRange(median: number, u = SOLAR_GENERATION_REL_UNCERTAINTY, note = SOLAR_RANGE_NOTE): ValueRange {
  // 中值为负（如峰谷价差为负的储能年收益）时 median×(1−u) 反而更大：按大小排序，保证 low ≤ median ≤ high
  const a = median * (1 - u), b = median * (1 + u);
  return { low: Math.min(a, b), median, high: Math.max(a, b), relUncertainty: u, note };
}

/** 与发电量成反比的量（简单回收期）：发电量偏低时回收期变长 */
export function inverseRange(median: number, u = SOLAR_GENERATION_REL_UNCERTAINTY, note = SOLAR_RANGE_NOTE): ValueRange {
  return { low: median / (1 + u), median, high: median / (1 - u), relUncertainty: u, note };
}

/** 精度按中值的量级统一决定，保证区间两端与中值位数一致 */
function wanDecimals(median: number): number {
  const w = Math.abs(median) / 10000;
  return w >= 100 ? 0 : w >= 10 ? 1 : 2;
}

/** 格式化：≥1 万时以“万”为单位，例如“约 108–126 万度（中值 118 万）” */
export function formatRange(r: ValueRange, unit: string, opts: { decimals?: number } = {}): string {
  if (Math.abs(r.median) >= 10000) {
    const d = wanDecimals(r.median);
    const w = (n: number) => (n / 10000).toFixed(d);
    const u = /^[A-Za-z]/.test(unit) ? ` ${unit}` : unit;
    return `约 ${w(r.low)}–${w(r.high)} 万${u}（中值 ${w(r.median)} 万）`;
  }
  const d = opts.decimals ?? 0;
  const f = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `约 ${f(r.low)}–${f(r.high)} ${unit}（中值 ${f(r.median)}）`;
}

/** 报告“不确定性”小节文字（自动生成） */
export function uncertaintySection(items: { label: string; range: ValueRange; unit: string; decimals?: number }[]): string[] {
  const lines = items.map((i) => `${i.label}：${formatRange(i.range, i.unit, { decimals: i.decimals })}`);
  return [
    ...lines,
    items[0]?.range.note ?? SOLAR_RANGE_NOTE,
    '电价、政策与设备价格变化未计入上述区间；单点中值不构成收益承诺。',
  ];
}

// ---------------------------------------------------------------------------
// 风电 / 储能的区间来源与 IRR、LCOE（LCOS）区间
// ---------------------------------------------------------------------------

/** 风电：卫星再分析月均风速仅适合初筛，发电量不确定度按 ±15%（与 wind.ts 结果说明一致） */
export const WIND_GENERATION_REL_UNCERTAINTY = 0.15;
export const WIND_RANGE_NOTE = '区间来自卫星再分析风速（NASA POWER 约 0.5° 网格月均值）与通用功率曲线的不确定性，按 ±15% 计；不能替代测风塔';

/** 储能：年运行天数、实际充放电深度与电价执行偏差，年收益/放电量按 ±10% 计 */
export const STORAGE_THROUGHPUT_REL_UNCERTAINTY = 0.10;
export const STORAGE_RANGE_NOTE = '区间来自年运行天数、实际充放电深度与峰谷价差执行偏差，年收益与放电量按 ±10% 计';

export type NullableRange = {
  low: number | null;
  median: number | null;
  high: number | null;
  relUncertainty: number;
  note: string;
}

/**
 * IRR 区间：收入按 (1 ± u) 缩放、成本不变，重算逐年现金流的唯一 IRR（%）；无唯一解的一端为 null。
 * revenues / costs 为第 1..N 年，investment 为第 0 年初始投资（正数）。
 */
export function irrRange(investment: number, revenues: number[], costs: number[], median: number | null, u: number, note: string): NullableRange {
  const at = (k: number) => {
    const r = solveIrr([-investment, ...revenues.map((rev, i) => rev * k - (costs[i] ?? 0))]);
    return r === null ? null : r * 100;
  };
  return { low: at(1 - u), median, high: at(1 + u), relUncertainty: u, note };
}

/** LCOE / LCOS 与发电（放电）量成反比：发电偏低时度电成本升高 */
export function levelizedCostRange(median: number, u: number, note: string): ValueRange {
  return inverseRange(median, u, note);
}

export function formatPercentRange(r: NullableRange): string {
  if (r.median === null) return '无唯一解';
  const f = (n: number | null) => (n === null ? '无解' : `${n.toFixed(1)}%`);
  return `约 ${f(r.low)}–${f(r.high)}（中值 ${r.median.toFixed(1)}%）`;
}
