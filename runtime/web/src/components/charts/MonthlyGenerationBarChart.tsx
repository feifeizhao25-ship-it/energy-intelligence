'use client';

/**
 * 月度发电量柱状图（测算结果页、光伏初步估算页、方案对比页共用）。
 *
 * 结果页原来自己画柱子：柱子是 `height: X%`，但它的父元素没有高度（height: auto），
 * 百分比高度按 CSS 规则无法计算、退化成 0——数据（energy.monthly）其实已经传到页面，柱子却全部是 0 像素高，
 * 看起来就是一张空图；全部为 0 时还会算出 NaN%。这里改为按像素计算柱高，并把数据整理成 12 个月。
 */

type EnergyData = { monthly?: unknown } | unknown[] | null | undefined;

export const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/** 把 energy.monthly（或直接的数组）整理成 12 个非负数；缺月、非数字按 0，并标记为缺失。 */
export function normalizeMonthly(data: EnergyData): { values: number[]; missing: boolean[]; hasData: boolean } {
    const source = Array.isArray(data) ? data : (data as { monthly?: unknown } | null | undefined)?.monthly;
    const raw: unknown[] = Array.isArray(source) ? source : [];
    const missing: boolean[] = [];
    const values = MONTH_LABELS.map((_, index) => {
        const item = raw[index];
        const value = Number(item);
        const ok = item !== null && item !== undefined && item !== '' && Number.isFinite(value) && value >= 0;
        missing.push(!ok);
        return ok ? value : 0;
    });
    return { values, missing, hasData: values.some(v => v > 0) };
}

/** 柱高（像素）：最大月 = areaPx；大于 0 的月份至少 2 像素，便于看出「有数但很小」。 */
export function monthlyBarHeights(values: number[], areaPx: number): number[] {
    const maximum = Math.max(0, ...values);
    if (!(maximum > 0)) return values.map(() => 0);
    return values.map(v => (v > 0 ? Math.max(2, Math.round((v / maximum) * areaPx)) : 0));
}

function formatKWh(value: number): string {
    if (value >= 10000) return `${(value / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`;
    return Math.round(value).toLocaleString('zh-CN');
}

export default function MonthlyGenerationBarChart({ data, theme = 'light', barAreaPx = 180 }: { data?: EnergyData; theme?: 'light' | 'dark'; barAreaPx?: number }) {
    const { values, missing, hasData } = normalizeMonthly(data);
    const heights = monthlyBarHeights(values, barAreaPx);
    const dark = theme === 'dark';
    const muted = dark ? 'text-slate-400' : 'text-slate-500';

    if (!hasData) {
        return (
            <p role="status" className={`rounded-xl px-4 py-6 text-center text-sm ${dark ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                这次测算没有返回月度发电量，无法绘制柱状图。
            </p>
        );
    }

    return (
        <figure>
            <div
                className="grid grid-cols-12 items-end gap-1 sm:gap-2"
                role="img"
                aria-label={`月度发电量柱状图：${values.map((v, i) => `${MONTH_LABELS[i]} ${Math.round(v)} 千瓦时`).join('，')}`}
            >
                {values.map((value, index) => (
                    <div key={MONTH_LABELS[index]} className="flex min-w-0 flex-col items-center justify-end gap-1">
                        <span className={`hidden text-[10px] sm:block ${muted}`}>{missing[index] ? '缺' : formatKWh(value)}</span>
                        <div
                            data-testid="monthly-bar"
                            className="w-full rounded-t bg-gradient-to-t from-blue-600 to-cyan-400"
                            style={{ height: `${heights[index]}px` }}
                            title={`${MONTH_LABELS[index]}：${missing[index] ? '缺数据' : `${Math.round(value).toLocaleString('zh-CN')} 千瓦时`}`}
                        />
                        <span className={`text-[10px] ${muted}`}>{MONTH_LABELS[index]}</span>
                    </div>
                ))}
            </div>
            <figcaption className={`mt-3 text-[11px] ${muted}`}>
                单位：千瓦时（度）。按历史一年的资源数据估算，实际逐月发电会随天气变化。
            </figcaption>
        </figure>
    );
}
