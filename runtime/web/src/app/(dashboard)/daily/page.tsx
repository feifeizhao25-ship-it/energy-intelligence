'use client';

import { useEffect, useState } from 'react';

interface Card { title: string; value: string; unit: string; note: string; source?: string; loaded: boolean }

export default function DailyPage() {
    const [cards, setCards] = useState<Card[]>([]);
    useEffect(() => {
        fetch('/api/daily').then((response) => response.json()).then((body) => {
            setCards(body.cards || (body.data ? [body.data] : []));
        }).catch(() => setCards([{
            title: '每日一数', value: '—', unit: '', note: '数据尚未加载。', loaded: false,
        }]));
    }, []);
    return <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-2xl font-bold">每日一数</h1>
        <div className="grid gap-3 md:grid-cols-3">
            {cards.map((card) => <section key={card.title} className="rounded-2xl border p-6">
                <p className="text-sm text-slate-500">{card.title}</p>
                <p className="mt-2 text-4xl font-bold">{card.value}</p>
                <p className="mt-1 text-slate-700">{card.unit}</p>
                <p className="mt-4 text-sm text-slate-600">{card.note}</p>
                {card.source && <p className="mt-2 text-xs text-slate-400">来源：{card.source}</p>}
            </section>)}
        </div>
    </main>;
}
