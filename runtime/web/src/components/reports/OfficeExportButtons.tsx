'use client';

import { useState } from 'react';

export function OfficeExportButtons({ title, rows }: { title: string; rows: string[][] }) {
    const [message, setMessage] = useState('');
    async function download(format: 'xlsx' | 'pptx') {
        setMessage('');
        const response = await fetch('/api/exports/office', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format, title, rows }),
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            setMessage(payload?.message || '导出没有完成');
            return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = format === 'xlsx' ? '新能源智库.xlsx' : '新能源智库.pptx';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" onClick={() => download('xlsx')}>导出 Excel</button>
        <button type="button" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" onClick={() => download('pptx')}>导出 PPT</button>
        {message && <p className="text-sm text-amber-800">{message}</p>}
    </div>;
}
