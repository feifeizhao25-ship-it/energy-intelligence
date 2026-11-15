import type { ReactNode } from 'react';

export interface FreshnessView {
    level: 'valid' | 'due' | 'expired' | 'unconnected';
    label: string;
    usable: boolean;
}

function dayStamp(value: Date): string {
    return value.toISOString().slice(0, 10);
}

/** 与后端 freshness_board.badge 同一口径。没有日期时显示未连接。 */
export function freshnessView(asOf: string | null | undefined, intervalDays: number, today = new Date()): FreshnessView {
    if (!asOf) return { level: 'unconnected', label: '未连接', usable: false };
    const verified = String(asOf).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(verified)) return { level: 'expired', label: '已过期 · 不参与测算', usable: false };
    const todayStamp = dayStamp(today);
    if (verified > todayStamp) return { level: 'expired', label: '已过期 · 不参与测算', usable: false };
    const age = Math.round((Date.parse(todayStamp) - Date.parse(verified)) / 86400000);
    const interval = Math.max(intervalDays, 1);
    if (age > interval) return { level: 'expired', label: `已过期 · 不参与测算（截至 ${verified}）`, usable: false };
    if (interval - age <= 7) return { level: 'due', label: `临近复核（≤7 天） · 截至 ${verified}`, usable: true };
    return { level: 'valid', label: `有效 · 截至 ${verified}`, usable: true };
}

const TONE = {
    valid: 'bg-emerald-500/15 text-emerald-700',
    due: 'bg-amber-500/15 text-amber-800',
    expired: 'bg-rose-500/15 text-rose-800',
    unconnected: 'bg-slate-200 text-slate-600',
};

export function FreshnessBadge({ asOf, intervalDays, today }: { asOf?: string | null; intervalDays: number; today?: Date }) {
    const view = freshnessView(asOf, intervalDays, today);
    return <span data-testid="freshness-badge" className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${TONE[view.level]}`}>{view.label}</span>;
}

/** 过期或未连接的输入不参与测算。 */
export function FreshnessGate({
    asOf,
    intervalDays,
    children,
}: {
    asOf?: string | null;
    intervalDays: number;
    children: ReactNode;
}) {
    const view = freshnessView(asOf, intervalDays);
    return (
        <fieldset disabled={!view.usable} className="min-w-0 space-y-2">
            <FreshnessBadge asOf={asOf} intervalDays={intervalDays} />
            {children}
            {!view.usable && <p className="text-xs text-rose-700">该输入未连接或已过期，不参与测算。</p>}
        </fieldset>
    );
}
