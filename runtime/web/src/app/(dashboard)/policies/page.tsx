'use client';

import { useState, type FormEvent } from 'react';

export default function PoliciesPage() {
    const [q, setQ] = useState('');
    const [rows, setRows] = useState<Array<{ id: string; region: string; sourceTitle?: string | null; docNumber?: string | null; type: string }>>([]);
    const [note, setNote] = useState('只显示已审核且处于生效期内的条目。');
    const [error, setError] = useState('');
    async function search(event: FormEvent) {
        event.preventDefault();
        setError('');
        const response = await fetch(`/api/policies?q=${encodeURIComponent(q)}`);
        const body = await response.json().catch(() => null);
        if (!response.ok) { setError('检索没有完成'); return; }
        setRows(body.data || []);
        setNote(body.note || note);
    }
    return <main className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">政策检索</h1>
        <p className="text-sm text-slate-600">{note}</p>
        <form onSubmit={search} className="flex gap-2">
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="省份、文号或标题" className="flex-1 rounded-xl border px-3 py-2" />
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-white">检索</button>
        </form>
        {error && <p className="text-amber-800">{error}</p>}
        <ul className="space-y-2">
            {rows.map((row) => <li key={row.id} className="rounded-xl border p-3">
                <div className="font-medium">{row.sourceTitle || row.type}</div>
                <div className="text-sm text-slate-600">{row.region} {row.docNumber || ''}</div>
            </li>)}
            {rows.length === 0 && <li className="text-sm text-slate-500">还没有匹配的生效条目。</li>}
        </ul>
    </main>;
}
