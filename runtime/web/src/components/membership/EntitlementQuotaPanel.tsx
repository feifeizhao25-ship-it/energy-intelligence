export interface QuotaRow {
    label: string;
    used: number;
    total: number | null;
    resetLabel: string;
}

/** 我的权益：已用、总量、重置时间。total 为空表示尚未连接，不显示成无限。 */
export function EntitlementQuotaPanel({ rows, sample = false }: { rows: QuotaRow[]; sample?: boolean }) {
    return (
        <section data-testid="my-entitlements" className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white">
            <h2 className="text-xl font-bold">我的权益</h2>
            {sample && <p className="mt-1 text-xs text-amber-300">示例数据</p>}
            <ul className="mt-4 space-y-3">
                {rows.map((row) => (
                    <li key={row.label}>
                        <div className="flex justify-between text-sm">
                            <span>{row.label}</span>
                            <span>{row.used} / {row.total === null ? '未连接' : row.total}</span>
                        </div>
                        <p className="text-xs text-slate-400">{row.resetLabel}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}
