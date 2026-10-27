'use client';

import { useState } from 'react';
import { estimateGridEmission } from '@/lib/calculator/carbon-factor';

export default function CarbonPage() {
    const [mwh, setMwh] = useState('');
    const [error, setError] = useState('');
    const [result, setResult] = useState<ReturnType<typeof estimateGridEmission> | null>(null);
    return <div className="mx-auto max-w-xl space-y-4 text-slate-900">
        <h1 className="text-2xl font-black">排放测算</h1>
        <p className="text-sm leading-6 text-slate-600">用公开的全国电力平均因子把上网电量换算成排放量。不填写碳资产售价，也不计算额外收益。</p>
        <label className="block text-sm">年上网电量（兆瓦时）<input value={mwh} onChange={(event) => setMwh(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={() => {
            setError('');
            try { setResult(estimateGridEmission(Number(mwh))); }
            catch { setResult(null); setError('年发电量必须是非负数字'); }
        }}>计算</button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {result && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-2">
            <p>排放量 {result.tonnesCo2} 吨</p>
            <p>因子 {result.factor} {result.unit}</p>
            <p>{result.source}</p>
            <p>{result.ccerNote}</p>
            <ul className="list-disc pl-5 text-slate-600">{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>}
    </div>;
}
