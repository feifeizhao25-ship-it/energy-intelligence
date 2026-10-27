'use client';

import { useEffect, useState } from 'react';

export default function BriefsPage() {
    const [title, setTitle] = useState('季度简报');
    const [paragraphs, setParagraphs] = useState<string[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        fetch('/api/briefs').then(async (response) => {
            const body = await response.json();
            if (!response.ok) { setError(body.error || '当前套餐不含季度简报'); return; }
            setTitle(body.data.title);
            setParagraphs(body.data.paragraphs || []);
        }).catch(() => setError('简报尚未加载'));
    }, []);
    return <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        {error && <p className="text-amber-800">{error}</p>}
        {paragraphs.map((paragraph) => <p key={paragraph} className="leading-7 text-slate-700">{paragraph}</p>)}
    </main>;
}
