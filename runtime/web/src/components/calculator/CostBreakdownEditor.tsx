'use client';

import { useState } from 'react';

/**
 * 成本构成：由用户按实际报价填写各部分占比。
 * 原来结果页把总投资固定按 85% / 10% / 5% 拆成「工程建设 / 并网 / 前期及不可预见」，没有任何来源，
 * 却像测算结论一样展示。现在输入框里的数字只是示例，页面明确写出「示例比例，请按实际报价填写」。
 */

export const COST_ITEMS = [
    { key: 'construction', label: '工程建设费用' },
    { key: 'grid', label: '并网及相关费用' },
    { key: 'development', label: '前期开发及不可预见' },
] as const;

export type CostKey = typeof COST_ITEMS[number]['key'];

/** 示例比例（%）——不是行业数据，只用来演示怎么填 */
export const EXAMPLE_SHARES: Record<CostKey, number> = { construction: 85, grid: 10, development: 5 };

export const EXAMPLE_NOTE = '示例比例，请按实际报价填写';

/** 按用户填写的占比拆分总投资。占比合计不等于 100% 时 sumOk = false，金额仍按各自占比计算。 */
export function splitInvestment(total: number, shares: Record<CostKey, number>) {
    const rows = COST_ITEMS.map(item => {
        const share = Number.isFinite(shares[item.key]) && shares[item.key] >= 0 ? shares[item.key] : 0;
        return { ...item, share, amount: total * share / 100 };
    });
    const sum = rows.reduce((s, r) => s + r.share, 0);
    return { rows, sum, sumOk: Math.abs(sum - 100) < 0.01 };
}

export default function CostBreakdownEditor({ investment }: { investment: number }) {
    const [shares, setShares] = useState<Record<CostKey, number>>(EXAMPLE_SHARES);
    const [edited, setEdited] = useState(false);
    const { rows, sum, sumOk } = splitInvestment(investment, shares);

    return (
        <div className="space-y-4">
            <p data-testid="cost-example-note" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-200">
                {edited ? '已按你填写的比例计算。' : `${EXAMPLE_NOTE}。`}总投资 ¥{Math.round(investment).toLocaleString('zh-CN')} 来自本次测算的单位造价 × 装机容量。
            </p>
            {rows.map(row => (
                <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                        <label htmlFor={`cost-${row.key}`} className="text-slate-400">{row.label}</label>
                        <span className="flex items-center gap-1">
                            <input
                                id={`cost-${row.key}`}
                                type="number"
                                min={0}
                                max={100}
                                step="any"
                                inputMode="decimal"
                                value={shares[row.key]}
                                onChange={e => { setEdited(true); setShares({ ...shares, [row.key]: e.target.value === '' ? 0 : Number(e.target.value) }); }}
                                className="w-16 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-right text-white"
                            />
                            <span className="text-slate-500">%</span>
                            <span className="ml-2 min-w-[7rem] text-right font-mono text-white">¥{Math.round(row.amount).toLocaleString('zh-CN')}</span>
                        </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, row.share)}%` }} />
                    </div>
                </div>
            ))}
            {!sumOk && (
                <p role="alert" className="text-[11px] text-rose-300">各项合计 {Number(sum.toFixed(2))}%，应为 100%，请调整。</p>
            )}
        </div>
    );
}
