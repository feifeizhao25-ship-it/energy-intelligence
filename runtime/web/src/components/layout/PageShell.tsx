import type { ReactNode } from 'react';
import Link from 'next/link';

export interface ShellFact {
    label: string;
    value: string;
}

export interface Crumb {
    href: string;
    label: string;
}

/** 顶部一句事实和三个关键数，下面主栏与辅栏，底部合规条。 */
export function PageShell({
    summary,
    facts,
    children,
    aside,
    sample = false,
    crumbs,
    title,
}: {
    summary: string;
    facts: [ShellFact, ShellFact, ShellFact];
    children: ReactNode;
    aside: ReactNode;
    sample?: boolean;
    crumbs?: Crumb[];
    title?: string;
}) {
    return (
        <div data-testid="page-shell" className="ei-shell overflow-x-hidden px-1 py-2 sm:px-2">
            {crumbs && crumbs.length > 0 ? (
                <nav aria-label="面包屑" className="mb-3 flex flex-wrap gap-1 text-xs text-[var(--ink-soft)]">
                    {crumbs.map((crumb, index) => (
                        <span key={crumb.href} className="inline-flex items-center gap-1">
                            {index > 0 ? <span aria-hidden="true">/</span> : null}
                            <Link href={crumb.href} className="underline-offset-2 hover:underline">{crumb.label}</Link>
                        </span>
                    ))}
                </nav>
            ) : null}
            <header className="ei-hero">
                {title ? <h1>{title}</h1> : null}
                <p className="text-sm leading-6">{summary}</p>
                {sample ? <p className="mt-1 text-xs text-amber-200">示例</p> : null}
                <dl className="ei-stats">
                    {facts.map((fact) => (
                        <div key={fact.label} className="ei-stat">
                            <dt>{fact.label}</dt>
                            <dd>{fact.value}</dd>
                        </div>
                    ))}
                </dl>
            </header>
            <div className="ei-split">
                <div className="min-w-0">{children}</div>
                <aside className="min-w-0 space-y-3">{aside}</aside>
            </div>
            <footer data-testid="compliance-bar" className="ei-compliance">
                测算值不是承诺。示例数据会标明「示例」。个性化可在设置里关闭。人工智能生成内容会单独标明。
            </footer>
        </div>
    );
}
