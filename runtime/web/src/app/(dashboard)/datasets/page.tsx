'use client';

import { useCallback, useEffect, useState } from 'react';
import attributions from '@/data/public-source-attributions.json';
import { disabledReasons, enabledAttributions } from '@/lib/data/public-attributions';
import { DataState, PageHeader } from '@/components/ui/design-system';

interface Dataset { id: string; title: string; kind: string; updated: string; columns: string[]; rows: string[][] }

export default function DatasetsPage() {
    const [items, setItems] = useState<Dataset[]>([]);
    const [note, setNote] = useState('');
    const [message, setMessage] = useState('');
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const load = useCallback(() => {
        setPhase('loading');
        setMessage('');
        fetch('/api/datasets').then((response) => response.json()).then((body) => {
            setItems(body.data?.datasets || []);
            setNote(body.data?.license_note || '');
            setPhase('ready');
        }).catch(() => {
            setMessage('数据集尚未加载');
            setPhase('error');
        });
    }, []);
    useEffect(() => { load(); }, [load]);
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
    return <main className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-hidden">
        <PageHeader
            kicker="数据"
            title="数据集"
            crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/datasets', label: '数据集' }]}
            summary={note || '已核验记录会列在下面，并保留来源署名。'}
        />
        {message && phase !== 'error' ? <p className="text-amber-800">{message}</p> : null}
        <DataState status={phase === 'ready' && items.length === 0 ? 'empty' : phase} emptyTitle="还没有可展示的数据集。" errorTitle={message || '数据集尚未加载'} onRetry={load}>
        <ul className="space-y-3">
            {items.map((item) => <li key={item.id} className="ei-panel">
                <h2 className="font-medium">{item.title}</h2>
                <p className="text-sm text-slate-500">{item.rows.length ? `${item.updated || ''} · ${item.rows.length} 行` : '尚未载入已核验记录'}</p>
                <div className="mt-3 max-w-full overflow-x-auto">
                    <table className="ei-table">
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
        </DataState>
        <section className="ei-panel space-y-3">
            <h2 className="text-xl font-bold">公开来源署名</h2>
            <p className="text-sm text-slate-600">启用的来源在展示数据时保留下面的署名。未启用的来源不会入库。</p>
            <ul className="space-y-2">
                {enabledAttributions(attributions).map((item) => <li key={item.id} className="rounded-xl border p-3 text-sm">
                    <p className="font-medium">{/[\u4e00-\u9fff]/.test(item.name) ? item.name : '公开来源'}</p>
                    <p className="mt-1 break-all text-slate-600">{item.attribution}</p>
                </li>)}
            </ul>
            <h3 className="font-medium">未启用</h3>
            <ul className="space-y-1 text-sm text-slate-600">
                {disabledReasons(attributions).map((item) => {
                    const chinese = (item.name.match(/[\u4e00-\u9fff]+/g) || []).join('');
                    return <li key={item.id}>{chinese || '未启用来源'}：{item.reason}</li>;
                })}
            </ul>
        </section>
    </main>;
}
