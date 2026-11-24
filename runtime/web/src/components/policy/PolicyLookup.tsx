'use client';

import { useState } from 'react';

type Item = {
    id?: string;
    title?: string;
    docNumber?: string;
    issuer?: string;
    effectiveDate?: string;
    expiryDate?: string;
    url?: string;
    status?: string;
    review?: string;
    supersededBy?: string | null;
};

export function PolicyLookup() {
    const [query, setQuery] = useState('发改能源规〔2021〕280号');
    const [items, setItems] = useState<Item[]>([]);
    const [note, setNote] = useState('输入文号后检索资料库。失效文件会标成已失效，不会被静默丢掉。');

    async function search() {
        const response = await fetch(`/api/policies/lookup?q=${encodeURIComponent(query)}`);
        const body = await response.json();
        const found = Array.isArray(body.items) ? body.items as Item[] : [];
        setItems(found);
        setNote(found.length ? `找到 ${found.length} 条。` : '资料库没有这条文号。');
    }

    return (
        <section className="ei-panel space-y-3" data-testid="policy-lookup">
            <div className="flex flex-wrap gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" aria-label="政策文号" />
                <button type="button" className="rounded-xl bg-[var(--moss)] px-3 py-2 text-sm text-white" onClick={() => void search()}>检索</button>
            </div>
            <p className="text-sm text-[var(--ink-soft)]">{note}</p>
            <ul className="space-y-3">
                {items.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-[var(--line)] p-3 text-sm leading-6">
                        <div className="flex flex-wrap gap-2">
                            <span className={item.status === '已失效' ? 'rounded-full bg-amber-100 px-2 py-0.5 text-amber-900' : 'rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900'}>{item.status}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5">{item.review}</span>
                        </div>
                        <h3 className="mt-2 font-semibold">{item.title}</h3>
                        <p>文号 {item.docNumber} · {item.issuer}</p>
                        <p>生效 {item.effectiveDate || '未登记'} · 届满 {item.expiryDate || '未登记'}</p>
                        {item.status === '已失效' && <p>替代关系：{item.supersededBy || '资料库尚未登记经人工确认的替代文件。'}</p>}
                        {item.url && <a className="underline" href={item.url}>原文链接</a>}
                    </li>
                ))}
            </ul>
        </section>
    );
}
