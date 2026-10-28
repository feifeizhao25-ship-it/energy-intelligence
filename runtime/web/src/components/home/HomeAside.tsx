'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, Landmark, TimerReset } from 'lucide-react';
import { TARIFFS, provincesWithPrices, tariffDisclosure } from '@/lib/pricing/tariffs';

interface PolicyItem {
    title: string;
    when: string;
}

interface PolicyState {
    phase: 'loading' | 'ready' | 'empty' | 'error';
    note: string;
    todayCount: number | null;
    items: PolicyItem[];
}

function titleOf(row: Record<string, unknown>): string {
    const title = row.sourceTitle || row.title || row.type;
    return typeof title === 'string' && title.trim() ? title.trim() : '未命名条目';
}

function whenOf(row: Record<string, unknown>): string {
    const raw = row.updatedAt || row.updated_at || row.effective_date || row.effectiveDate;
    if (typeof raw !== 'string' || raw.length < 10) return '日期未标注';
    return raw.slice(0, 10);
}

/** 右侧三块只展示接口或电价表里已有的事实。失败时写未连接，不补数字。 */
export function HomeAside() {
    const [policy, setPolicy] = useState<PolicyState>({
        phase: 'loading',
        note: '正在读取已审核政策。',
        todayCount: null,
        items: [],
    });

    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        let cancelled = false;
        fetch('/api/policies')
            .then(async (response) => {
                const body = await response.json().catch(() => null);
                if (cancelled) return;
                if (!response.ok || !body) {
                    setPolicy({ phase: 'error', note: body?.note || '政策库未连接', todayCount: null, items: [] });
                    return;
                }
                const rows = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
                const items = rows.slice(0, 4).map((row) => ({ title: titleOf(row), when: whenOf(row) }));
                const dated = rows.filter((row) => whenOf(row) !== '日期未标注');
                const todayCount = dated.length ? dated.filter((row) => whenOf(row) === today).length : null;
                setPolicy({
                    phase: items.length ? 'ready' : 'empty',
                    note: typeof body.note === 'string' ? body.note : '只显示已审核条目。',
                    todayCount,
                    items,
                });
            })
            .catch(() => {
                if (!cancelled) setPolicy({ phase: 'error', note: '政策库未连接', todayCount: null, items: [] });
            });
        return () => { cancelled = true; };
    }, []);

    const priced = provincesWithPrices();
    const freshness = priced.map((name) => tariffDisclosure(TARIFFS[name]));
    const stale = freshness.filter((item) => item.freshness.stale).length;

    return (
        <div className="space-y-3">
            <section className="ei-panel space-y-2" data-testid="policy-today">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Landmark className="h-4 w-4" aria-hidden="true" />
                    今日政策更新
                </h2>
                <p className="text-xs leading-5 text-[var(--ink-soft)]">{policy.note}</p>
                {policy.todayCount !== null ? (
                    <p className="text-sm tabular-nums">今日已审核更新 {policy.todayCount} 条</p>
                ) : null}
                {policy.phase === 'empty' ? <p className="text-sm">今天没有新的已审核政策。</p> : null}
                <ul className="space-y-2">
                    {policy.items.map((item) => (
                        <li key={`${item.title}-${item.when}`} className="text-sm">
                            <div className="font-medium">{item.title}</div>
                            <div className="text-xs text-[var(--ink-soft)]">{item.when}</div>
                        </li>
                    ))}
                </ul>
                <Link href="/policies" className="inline-block text-xs underline-offset-2 hover:underline">打开政策检索</Link>
            </section>

            <section className="ei-panel space-y-2" data-testid="data-freshness">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <TimerReset className="h-4 w-4" aria-hidden="true" />
                    数据新鲜度
                </h2>
                <p className="text-sm tabular-nums">已收录电价 {priced.length} 省，其中 {stale} 省超过核对间隔。</p>
                <p className="text-xs leading-5 text-[var(--ink-soft)]">来源：站内省级电价表。没有标注截至日期的省份不计入。</p>
                <ul className="max-h-40 space-y-1 overflow-auto text-xs">
                    {freshness.map((item) => (
                        <li key={item.province} className="flex items-center justify-between gap-2">
                            <span>{item.province}</span>
                            <span className="ei-badge" data-tone={item.freshness.stale ? 'warn' : 'up'}>{item.freshness.label}</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="ei-panel space-y-2" data-testid="quick-calc">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Calculator className="h-4 w-4" aria-hidden="true" />
                    快捷测算
                </h2>
                <p className="text-xs leading-5 text-[var(--ink-soft)]">填写地址、装机和电价后才计算结果。这里不预填发电量。</p>
                <div className="grid gap-2">
                    <Link href="/calculator/solar" className="rounded-xl border border-[var(--line)] px-3 py-2 text-center text-sm">光伏测算</Link>
                    <Link href="/calculator/wind" className="rounded-xl border border-[var(--line)] px-3 py-2 text-center text-sm">风电测算</Link>
                    <Link href="/calculator/storage" className="rounded-xl border border-[var(--line)] px-3 py-2 text-center text-sm">储能测算</Link>
                </div>
            </section>
        </div>
    );
}
