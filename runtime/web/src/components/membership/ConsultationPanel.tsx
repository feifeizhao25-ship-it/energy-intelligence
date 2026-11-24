'use client';

import { useState } from 'react';

export function ConsultationPanel() {
    const [topic, setTopic] = useState('');
    const [note, setNote] = useState('定制研究只登记事实、数据、政策和可核验计算。不提供投资结论、收益承诺或价格预测。');

    async function submit() {
        const response = await fetch('/api/membership/consult', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic }),
        });
        const body = await response.json().catch(() => ({}));
        setNote(body.message || body.error || '登记没有完成。');
    }

    return (
        <section className="mt-6 rounded-2xl border border-[var(--line)] p-4" data-testid="consultation-panel">
            <h2 className="text-base font-semibold">艾瑞能见定制研究</h2>
            <p className="mt-2 text-sm leading-6">{note}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="咨询主题" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
                <button type="button" className="rounded-xl bg-[var(--moss)] px-3 py-2 text-sm text-white" onClick={() => void submit()}>登记</button>
            </div>
        </section>
    );
}
