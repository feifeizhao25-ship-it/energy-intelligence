import type { ReactNode } from 'react';

export interface ShellFact {
    label: string;
    value: string;
}

/** 顶部一句事实和三个关键数，下面主栏与辅栏，底部合规条。 */
export function PageShell({
    summary,
    facts,
    children,
    aside,
    sample = false,
}: {
    summary: string;
    facts: [ShellFact, ShellFact, ShellFact];
    children: ReactNode;
    aside: ReactNode;
    sample?: boolean;
}) {
    return (
        <div data-testid="page-shell" className="mx-auto w-full max-w-[1440px] overflow-x-hidden px-3 py-4 text-[var(--ink)]">
            <header className="rounded-2xl bg-[var(--moss)] px-4 py-3 text-white">
                <p className="text-sm leading-6">{summary}</p>
                {sample ? <p className="mt-1 text-xs text-amber-200">示例</p> : null}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {facts.map((fact) => (
                        <div key={fact.label}>
                            <dt className="text-xs text-white/80">{fact.label}</dt>
                            <dd className="text-sm font-semibold tabular-nums">{fact.value}</dd>
                        </div>
                    ))}
                </dl>
            </header>
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
                <div className="min-w-0">{children}</div>
                <aside className="min-w-0 space-y-3">{aside}</aside>
            </div>
            <footer data-testid="compliance-bar" className="mt-4 rounded-xl border border-[var(--line)] px-3 py-2 text-xs leading-5 text-[var(--ink-soft)]">
                测算值不是承诺。示例数据会标明「示例」。个性化可在设置里关闭。人工智能生成内容会单独标明。
            </footer>
        </div>
    );
}
