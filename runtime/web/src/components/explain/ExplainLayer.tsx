const FACT_BANNED = ['建议', '值得', '划算', '利好'];

export function factLineIssues(fact: string): string[] {
    return FACT_BANNED.filter((word) => fact.includes(word));
}

export interface ExplainSource {
    title: string;
    locator?: string;
    status?: '已核验' | '待核验' | '冲突' | '不支持';
}

/** 结果卡上的事实、算法和出处。事实句不得出现建议、值得、划算、利好。 */
export function ExplainLayer({
    fact,
    method,
    sources,
    sample = false,
}: {
    fact: string;
    method: string;
    sources: ExplainSource[];
    sample?: boolean;
}) {
    const issues = factLineIssues(fact);
    return (
        <section data-testid="explain-layer" className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm leading-6 text-slate-200">
            {sample && <p className="mb-2 text-xs text-amber-300">示例数据</p>}
            <h2 className="text-base font-bold text-white">怎么算出这个数</h2>
            <p data-testid="explain-fact" className="mt-2">
                {issues.length ? '事实句含禁用词，已隐藏。' : fact}
            </p>
            <p className="mt-2 text-slate-300"><span className="text-slate-400">算法：</span>{method}</p>
            <ul className="mt-3 space-y-1">
                {sources.map((source) => (
                    <li key={`${source.title}-${source.locator ?? ''}`}>
                        {source.status === '不支持'
                            ? '未在已收录原文中找到出处'
                            : `${source.title}${source.locator ? ` ${source.locator}` : ''} · ${source.status ?? '待核验'}`}
                    </li>
                ))}
            </ul>
        </section>
    );
}
