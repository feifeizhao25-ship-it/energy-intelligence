'use client';

import { useState } from 'react';
import Link from 'next/link';

type Result = Record<string, unknown> | null;

export default function DiagnosticsWorkbench() {
    const [result, setResult] = useState<Result>(null);
    const [error, setError] = useState('');
    const [actualKwh, setActualKwh] = useState('');
    const [theoreticalKwh, setTheoreticalKwh] = useState('');
    const [code, setCode] = useState('');
    const [symptoms, setSymptoms] = useState('');
    const [iv, setIv] = useState({ vocNom: '', iscNom: '', vmpNom: '', impNom: '', vocMeas: '', iscMeas: '', vmpMeas: '', impMeas: '', irradiance: '', temperature: '' });

    async function run(kind: string, body: Record<string, unknown>) {
        setError('');
        setResult(null);
        const response = await fetch('/api/maintenance/diagnostics', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind, ...body }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            setError(payload.error || '诊断没有完成');
            return;
        }
        setResult(payload.data || null);
    }

    return <div className="mx-auto max-w-3xl space-y-8 text-slate-900">
        <div className="ei-panel">
            <h2 className="text-lg font-bold">填写后计算</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">性能比、组件曲线和故障代码只使用本页填写的数字。结果是比值或手册对照，不是维修投资建议。项目工单和遥测在具体项目的运维页。</p>
            <Link href="/projects" className="mt-2 inline-block text-sm font-bold text-[var(--teal)]">前往项目</Link>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-bold">性能比</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">实际发电量<input value={actualKwh} onChange={(event) => setActualKwh(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
                <label className="text-sm">理论发电量<input value={theoreticalKwh} onChange={(event) => setTheoreticalKwh(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            </div>
            <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={() => { void run('pr', { actualKwh: Number(actualKwh), theoreticalKwh: Number(theoreticalKwh) }); }}>计算性能比</button>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-bold">组件曲线</h2>
            <div className="grid gap-3 sm:grid-cols-2">
                {([
                    ['vocNom', '额定开路电压'], ['iscNom', '额定短路电流'], ['vmpNom', '额定最大功率点电压'], ['impNom', '额定最大功率点电流'],
                    ['vocMeas', '实测开路电压'], ['iscMeas', '实测短路电流'], ['vmpMeas', '实测最大功率点电压'], ['impMeas', '实测最大功率点电流'],
                    ['irradiance', '辐照'], ['temperature', '温度'],
                ] as const).map(([key, label]) => (
                    <label key={key} className="text-sm">{label}<input value={iv[key]} onChange={(event) => setIv({ ...iv, [key]: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
                ))}
            </div>
            <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={() => {
                const numbers = Object.fromEntries(Object.entries(iv).map(([key, value]) => [key, Number(value)]));
                void run('iv', numbers);
            }}>比较填充因子</button>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-bold">逆变器代码</h2>
            <label className="text-sm">故障代码<input value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label className="text-sm">现象<textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={() => { void run('inverter', { code, symptoms }); }}>对照手册提示</button>
        </section>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {result && <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>}
    </div>;
}
