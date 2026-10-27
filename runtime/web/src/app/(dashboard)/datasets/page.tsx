'use client';

import { useEffect, useState } from 'react';
import attributions from '@/data/public-source-attributions.json';
import { disabledReasons, enabledAttributions } from '@/lib/data/public-attributions';

interface Dataset { id: string; title: string; kind: string; updated: string; columns: string[]; rows: string[][] }

export default function DatasetsPage() {
    const [items, setItems] = useState<Dataset[]>([]);
    const [note, setNote] = useState('');
    const [message, setMessage] = useState('');
    useEffect(() => {
        fetch('/api/datasets').then((response) => response.json()).then((body) => {
            setItems(body.data?.datasets || []);
            setNote(body.data?.license_note || '');
        }).catch(() => setMessage('数据集尚未加载'));
    }, []);
    async function download(id: string) {
        setMessage('');
        const response = await fetch(`/api/datasets?id=${encodeURIComponent(id)}`);
        if (!response.ok) {
            const body = await response.json().catch(() => null);
            setMessage(body?.error || '下载没有完成');
            return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${id}.csv`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return <main className="mx-auto max-w-4xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">数据集</h1>
        <p className="text-sm text-slate-600">{note}</p>
        {message && <p className="text-amber-800">{message}</p>}
        <ul className="space-y-3">
            {items.map((item) => <li key={item.id} className="rounded-xl border p-4">
                <h2 className="font-medium">{item.title}</h2>
                <p className="text-sm text-slate-500">{item.rows.length ? `${item.updated || ''} · ${item.rows.length} 行` : '尚未载入已核验记录'}</p>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead><tr>{item.columns.map((column) => <th key={column} className="border-b px-2 py-1 font-medium">{column}</th>)}</tr></thead>
                        <tbody>
                            {item.rows.map((row, index) => <tr key={index}>
                                {row.map((cell, cellIndex) => <td key={cellIndex} className="border-b px-2 py-1">{cell}</td>)}
                            </tr>)}
                        </tbody>
                    </table>
                </div>
                <button className="mt-2 rounded-xl border px-3 py-1 text-sm" onClick={() => download(item.id)}>下载 CSV</button>
            </li>)}
        </ul>
        <section className="space-y-3">
            <h2 className="text-xl font-bold">公开来源署名</h2>
            <p className="text-sm text-slate-600">启用的来源在展示数据时保留下面的署名。未启用的来源不会入库。</p>
            <ul className="space-y-2">
                {enabledAttributions(attributions).map((item) => <li key={item.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-slate-600">{item.attribution}</p>
                </li>)}
            </ul>
            <h3 className="font-medium">未启用</h3>
            <ul className="space-y-1 text-sm text-slate-600">
                {disabledReasons(attributions).map((item) => <li key={item.id}>{item.name}：{item.reason}</li>)}
            </ul>
        </section>
    </main>;
}
