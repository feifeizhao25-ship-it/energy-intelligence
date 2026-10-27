'use client';

import { useEffect, useState } from 'react';

interface Layer { id: string; title: string; empty: boolean; message: string; features: unknown[] }

export default function VectorLayerPanel() {
    const [note, setNote] = useState('');
    const [layers, setLayers] = useState<Layer[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        fetch('/api/map/layers').then((response) => response.json()).then((body) => {
            setNote(body.data?.licenseNote || '');
            setLayers(body.data?.layers || []);
        }).catch(() => setError('图层暂时无法读取'));
    }, []);
    return <section className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800">
        <h2 className="text-lg font-bold">并网与用地图层</h2>
        <p className="mt-2 text-sm text-slate-600">{note}</p>
        {error && <p className="mt-2 text-sm text-amber-800">{error}</p>}
        <ul className="mt-3 space-y-2">
            {layers.map((layer) => <li key={layer.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <strong>{layer.title}</strong>
                <span className="ml-2 text-slate-600">{layer.empty ? '空' : `${layer.features.length} 个要素`}</span>
                <p className="mt-1 text-slate-500">{layer.message}</p>
            </li>)}
        </ul>
    </section>;
}
