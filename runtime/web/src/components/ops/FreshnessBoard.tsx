export interface FreshnessRow {
    name: string;
    status: string;
    asOf: string;
}

/** 时效看板。示例行必须标明示例，连续未处理才升级。 */
export function FreshnessBoard({ rows, escalated = [], sample = true }: { rows: FreshnessRow[]; escalated?: string[]; sample?: boolean }) {
    return (
        <section aria-label="时效看板" className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <header className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--ink)]">时效看板</h2>
                {sample ? <span className="rounded-full bg-[var(--paper)] px-2 py-1 text-xs text-[var(--warn)]">示例</span> : null}
            </header>
            <div className="max-w-full overflow-x-auto">
            <table className="ei-table">
                <thead>
                    <tr className="text-[var(--ink-soft)]">
                        <th className="py-1">类型</th>
                        <th>状态</th>
                        <th>截至</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.name} className="border-t border-[var(--line)]">
                            <td className="py-2">{row.name}{escalated.includes(row.name) ? '（已升级）' : ''}</td>
                            <td>{row.status}</td>
                            <td className="tabular-nums">{row.asOf}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]">企业微信未配置时只记在本地，不外发。</p>
        </section>
    );
}
