'use client';

import { useState } from 'react';
import { calculateCharging } from '@/lib/calculator/charging';

export default function ChargingPage() {
    const [sessions, setSessions] = useState('10');
    const [kwh, setKwh] = useState('30');
    const [price, setPrice] = useState('');
    const [fee, setFee] = useState('0');
    const [error, setError] = useState('');
    const [result, setResult] = useState<ReturnType<typeof calculateCharging> | null>(null);

    return <div className="mx-auto max-w-xl space-y-4 text-slate-900">
        <h1 className="text-2xl font-black">充电测算</h1>
        <p className="text-sm leading-6 text-slate-600">电量、电价和服务费都由你填写。这里不算利用率，也不预测电价。</p>
        <label className="block text-sm">充电次数<input value={sessions} onChange={(event) => setSessions(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="block text-sm">每次电量（千瓦时）<input value={kwh} onChange={(event) => setKwh(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="block text-sm">电价（元每千瓦时）<input value={price} onChange={(event) => setPrice(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <label className="block text-sm">单次服务费（元）<input value={fee} onChange={(event) => setFee(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
        <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" onClick={() => {
            setError('');
            try {
                setResult(calculateCharging({
                    sessions: Number(sessions),
                    kwhPerSession: Number(kwh),
                    electricityPriceYuanPerKwh: Number(price),
                    serviceFeeYuanPerSession: Number(fee),
                }));
            } catch (cause) {
                setResult(null);
                setError(cause instanceof Error ? '请填写大于零的次数和电量，电价与服务费不能为负' : '测算失败');
            }
        }}>计算</button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {result && <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-2">
            <p>电量 {result.energyKwh} 千瓦时</p>
            <p>电费 {result.electricityCostYuan} 元</p>
            <p>服务费 {result.serviceFeeYuan} 元</p>
            <p>合计 {result.totalYuan} 元</p>
            <ul className="list-disc pl-5 text-slate-600">{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>}
    </div>;
}
