'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { BuildStamp } from '@/components/layout/BuildStamp';
import { PRODUCT_ROLES, ROLE_LABELS, type ProductRole } from '@/lib/dashboard/personalization';

function TopBarInner() {
    const router = useRouter();
    const search = useSearchParams();
    const current = search.get('role');
    const role: ProductRole = current && (PRODUCT_ROLES as readonly string[]).includes(current)
        ? current as ProductRole
        : 'ci_owner';
    const [query, setQuery] = useState(search.get('q') || '');

    function submit(event: FormEvent) {
        event.preventDefault();
        const q = query.trim();
        router.push(q ? `/policies?q=${encodeURIComponent(q)}` : '/policies');
    }

    return (
        <div className="ei-topbar">
            <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2" role="search">
                <label className="sr-only" htmlFor="topbar-search">检索政策</label>
                <Search className="hidden h-4 w-4 shrink-0 text-[var(--ink-soft)] sm:block" aria-hidden="true" />
                <input
                    id="topbar-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="检索已审核政策"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ink-soft)]"
                />
                <button type="submit" className="shrink-0 rounded-lg bg-[var(--accent-solid)] px-3 py-1.5 text-xs font-semibold text-white">
                    检索
                </button>
            </form>
            <label className="flex shrink-0 items-center gap-2 text-xs text-[var(--ink-soft)]">
                角色
                <select
                    aria-label="切换角色"
                    value={role}
                    onChange={(event) => router.push(`/?role=${encodeURIComponent(event.target.value)}`)}
                    className="max-w-[9rem] rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 text-sm text-[var(--ink)]"
                >
                    {PRODUCT_ROLES.map((key) => (
                        <option key={key} value={key}>{ROLE_LABELS[key]}</option>
                    ))}
                </select>
            </label>
            <BuildStamp />
        </div>
    );
}

export function TopBar() {
    return (
        <Suspense fallback={<div className="ei-topbar" aria-hidden="true" />}>
            <TopBarInner />
        </Suspense>
    );
}
