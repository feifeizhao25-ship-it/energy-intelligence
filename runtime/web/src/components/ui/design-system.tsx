'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <section className={`ei-panel ${className}`.trim()}>{children}</section>;
}

export function Badge({ children, tone = 'up' }: { children: ReactNode; tone?: 'up' | 'down' | 'warn' }) {
    return <span className="ei-badge" data-tone={tone}>{children}</span>;
}

export function Tabs({ children }: { children: ReactNode }) {
    return <div role="tablist" className="flex flex-wrap gap-2">{children}</div>;
}

export function FilterBar({ children }: { children: ReactNode }) {
    return <div className="ei-filter">{children}</div>;
}

export function PageHeader({
    kicker,
    title,
    summary,
    crumbs,
    actions,
}: {
    kicker?: string;
    title: string;
    summary?: string;
    crumbs?: { href: string; label: string }[];
    actions?: ReactNode;
}) {
    return (
        <header className="ei-page-head mb-4">
            {crumbs && crumbs.length > 0 ? (
                <nav aria-label="面包屑" className="mb-2 flex flex-wrap gap-1 text-xs text-white/70">
                    {crumbs.map((crumb, index) => (
                        <span key={crumb.href} className="inline-flex items-center gap-1">
                            {index > 0 ? <span aria-hidden="true">/</span> : null}
                            <Link href={crumb.href} className="hover:underline">{crumb.label}</Link>
                        </span>
                    ))}
                </nav>
            ) : null}
            {kicker ? <p className="ei-kicker">{kicker}</p> : null}
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <h1>{title}</h1>
                    {summary ? <p className="mt-2 max-w-3xl text-sm leading-6">{summary}</p> : null}
                </div>
                {actions}
            </div>
        </header>
    );
}

export function LoadingBlock() {
    return (
        <div data-testid="loading-skeleton" className="space-y-3" aria-busy="true">
            <div className="ei-skeleton h-8 w-1/3" />
            <div className="ei-skeleton h-24 w-full" />
            <div className="ei-skeleton h-24 w-full" />
        </div>
    );
}

export function DataState({
    status,
    emptyTitle,
    errorTitle = '这一页暂时没有加载成功',
    onRetry,
    children,
}: {
    status: 'loading' | 'empty' | 'error' | 'ready';
    emptyTitle: string;
    errorTitle?: string;
    onRetry?: () => void;
    children?: ReactNode;
}) {
    if (status === 'loading') return <LoadingBlock />;
    if (status === 'error') {
        return (
            <div data-testid="error-state" className="ei-error" role="alert">
                <p className="font-semibold">{errorTitle}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">可以重试。若仍失败，请稍后再打开这一页。</p>
                {onRetry ? <button type="button" className="mt-3 rounded-xl bg-[var(--navy)] px-3 py-2 text-sm text-white" onClick={onRetry}>重试</button> : null}
            </div>
        );
    }
    if (status === 'empty') {
        return (
            <div data-testid="empty-state" className="ei-empty">
                <p className="font-semibold">{emptyTitle}</p>
                <p className="mt-1 text-sm text-[var(--ink-soft)]">下一步：调整筛选，或先打开一份已审核的记录。</p>
            </div>
        );
    }
    return <>{children}</>;
}
