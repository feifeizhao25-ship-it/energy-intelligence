'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { BuildStamp } from '@/components/layout/BuildStamp';
import { ROLE_LABELS } from '@/lib/dashboard/personalization';
import { isKnownRole, SELECTABLE_ROLES } from '@/lib/dashboard/visible-role';
import { useRolePreference } from '@/components/layout/RolePreference';

function TopBarInner() {
    const router = useRouter();
    const { role, ready, selectRole } = useRolePreference();
    const [query, setQuery] = useState('');
    useEffect(() => {
        setQuery(new URLSearchParams(window.location.search).get('q') || '');
    }, []);

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
                    value={role ?? ''}
                    disabled={!ready && !role}
                    onChange={(event) => selectRole(event.target.value)}
                    className="max-w-[9rem] rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 text-sm text-[var(--ink)]"
                >
                    {!role ? <option value="">读取中</option> : null}
                    {role && !isKnownRole(role) ? <option value={role}>{role}</option> : null}
                    {SELECTABLE_ROLES.map((key) => (
                        <option key={key} value={key}>{ROLE_LABELS[key]}</option>
                    ))}
                </select>
            </label>
            <BuildStamp />
        </div>
    );
}

export function TopBar() {
    return <TopBarInner />;
}
