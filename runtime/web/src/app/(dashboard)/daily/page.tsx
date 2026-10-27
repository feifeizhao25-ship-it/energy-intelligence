'use client';

import { useEffect, useState } from 'react';

export default function DailyPage() {
    const [card, setCard] = useState<{ title: string; value: string; unit: string; note: string; loaded: boolean } | null>(null);
    useEffect(() => {
        fetch('/api/daily').then((response) => response.json()).then((body) => setCard(body.data)).catch(() => setCard({
            title: '每日一数', value: '—', unit: '', note: '数据尚未加载。', loaded: false,
        }));
    }, []);
    return <main className="mx-auto max-w-xl space-y-3 p-6">
        <h1 className="text-2xl font-bold">每日一数</h1>
        {card && <section className="rounded-2xl border p-6">
            <p className="text-sm text-slate-500">{card.title}</p>
            <p className="mt-2 text-4xl font-bold">{card.value}</p>
            <p className="mt-1 text-slate-700">{card.unit}</p>
            <p className="mt-4 text-sm text-slate-600">{card.note}</p>
        </section>}
    </main>;
}
