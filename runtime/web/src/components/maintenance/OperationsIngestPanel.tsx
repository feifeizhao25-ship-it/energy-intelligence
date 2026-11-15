'use client';

import { useState } from 'react';

const CSV_HEADER = 'point_id,timestamp,power_kw,energy_kwh,irradiance,alarm_code';

export default function OperationsIngestPanel({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
    const [title, setTitle] = useState('');
    const [assignee, setAssignee] = useState('');
    const [type, setType] = useState('inspection');
    const [message, setMessage] = useState('');
    const [csvName, setCsvName] = useState('');
    const [metric, setMetric] = useState('power_kw');
    const [threshold, setThreshold] = useState('800');

    async function createOrder() {
        setMessage('');
        const response = await fetch(`/api/projects/${projectId}/maintenance`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title, type, priority: 'medium', assignee, description: '' }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? '工单已创建。通知结果以接口返回为准。' : (body.error || '工单创建失败'));
        if (response.ok) {
            setTitle('');
            onChanged();
        }
    }

    async function uploadCsv(file: File) {
        setMessage('');
        const text = await file.text();
        const response = await fetch(`/api/projects/${projectId}/telemetry`, {
            method: 'POST',
            headers: { 'content-type': 'text/csv' },
            body: text,
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? '遥测已入库。曲线只来自这些点。' : (body.error || '遥测未能入库'));
        if (response.ok) onChanged();
    }

    async function addRule() {
        setMessage('');
        const response = await fetch(`/api/projects/${projectId}/alarms`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ metric, operator: 'gt', threshold: Number(threshold), severity: 'warning' }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(response.ok ? '阈值已保存。越过阈值的点才会产生告警。' : (body.error || '阈值保存失败'));
    }

    return <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900">工单、遥测与阈值</h2>
        <p className="text-sm text-slate-500">没有入库遥测时，功率显示为未接入，不会补一条曲线。</p>
        <div className="grid gap-3 md:grid-cols-4">
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="工单标题" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="工单类型">
                <option value="cleaning">清洗</option>
                <option value="inspection">巡检</option>
                <option value="repair">检修</option>
                <option value="other">其他</option>
            </select>
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="负责人" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => { void createOrder(); }} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">创建工单</button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-bold text-slate-700">
                上传遥测表
                <input type="file" accept=".csv,text/csv" className="ml-2 text-sm" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setCsvName(file.name);
                    void uploadCsv(file);
                }} />
            </label>
            <button type="button" className="text-sm text-emerald-700 underline" onClick={() => {
                const blob = new Blob([`${CSV_HEADER}\n`], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'telemetry.csv';
                link.click();
                URL.revokeObjectURL(url);
            }}>下载表头模板</button>
            {csvName && <span className="text-xs text-slate-400">{csvName}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-700">功率阈值
                <input value={threshold} onChange={(event) => setThreshold(event.target.value)} className="ml-2 w-24 rounded-lg border border-slate-200 px-2 py-1" />
            </label>
            <select value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" aria-label="阈值指标">
                <option value="power_kw">功率</option>
                <option value="irradiance">辐照</option>
                <option value="alarm_code">告警代码</option>
            </select>
            <button type="button" onClick={() => { void addRule(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold">保存阈值</button>
        </div>
        {message && <p className="text-sm text-slate-700">{message}</p>}
    </section>;
}
