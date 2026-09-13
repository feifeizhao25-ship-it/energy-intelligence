'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Sun, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { requestSolarPreview, type SolarPreview, type SolarPreviewInput } from '@/lib/calculator/solar-preview-client';

const fields = [
    { key: 'lat', label: '项目纬度', unit: '度，南纬为负数', placeholder: '例如 39.90', min: -90, max: 90 },
    { key: 'lng', label: '项目经度', unit: '度，西经为负数', placeholder: '例如 116.40', min: -180, max: 180 },
    { key: 'capacity', label: '装机容量', unit: '千瓦', placeholder: '例如 100', min: 0.001 },
    { key: 'unitCost', label: '单位投资', unit: '元／千瓦，含安装', placeholder: '例如 3500', min: 0.001 },
    { key: 'electricityPrice', label: '每度电的平均价值', unit: '元／度', placeholder: '例如 0.65', min: 0 },
] as const;
const number = (value: number, digits = 2) => value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
const date = (value: string) => new Date(value).toLocaleDateString('zh-CN', { timeZone: 'UTC' });

export default function SolarCalculatorPage() {
    const [input, setInput] = useState<SolarPreviewInput>({ lat: '', lng: '', capacity: '', unitCost: '', electricityPrice: '' });
    const [result, setResult] = useState<SolarPreview | null>(null);
    const [submitted, setSubmitted] = useState<SolarPreviewInput | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const [ready, setReady] = useState(false);
    useEffect(() => setReady(true), []);
    async function calculate(event: React.FormEvent) {
        event.preventDefault();
        if (pending.current) return;
        pending.current = true;
        setBusy(true); setError(''); setResult(null);
        const values = { ...input };
        try { setResult(await requestSolarPreview(values)); setSubmitted(values); }
        catch (error) { setError(error instanceof Error ? error.message : '测算未完成，请稍后再试。'); }
        finally { pending.current = false; setBusy(false); }
    }
    return <div className="mx-auto max-w-5xl space-y-6 pb-12 text-slate-800">
        <Link href="/calculator" className="inline-flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16} />返回测算工具</Link>
        <header className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-sm text-amber-200"><Sun size={16} />光伏初步估算</div>
            <h1 className="text-2xl font-bold sm:text-3xl">先算清投入，再看回收可能</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">使用上一完整年的历史辐照资料和您填写的成本、电价，估算发电量与现金流。结果包含简化假设，不代表未来收益承诺或工程审计。</p>
        </header>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_0.8fr]">
            <form onSubmit={calculate} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <h2 className="text-lg font-bold">您的项目参数</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">请核对实际位置。示例仅提示格式，不会自动代入北京位置或参考电价。</p>
                <fieldset disabled={busy} className="mt-5 grid gap-5 sm:grid-cols-2">
                    {fields.map(field => <label key={field.key} htmlFor={field.key} className="space-y-2 text-sm">
                        <span className="block font-medium">{field.label}</span>
                        <span className="block text-xs text-slate-500">{field.unit}</span>
                        <input id={field.key} name={field.key} type="number" step="any" required min={field.min} max={'max' in field ? field.max : undefined}
                            placeholder={field.placeholder} value={input[field.key]}
                            onChange={event => { setInput({ ...input, [field.key]: event.target.value }); setResult(null); }}
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                    </label>)}
                </fieldset>
                <p className="mt-5 text-xs leading-6 text-slate-500">每度电的平均价值由您根据自用与售电情况填写，并按估算期内不变处理；系统未核验当地政策、补贴或电价。</p>
                {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{error}</p>}
                <button disabled={busy || !ready} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-60">
                    {busy && <Loader2 className="animate-spin" size={18} />}{!ready ? '正在准备表单…' : busy ? '正在核验资料并保存…' : '生成估算并保存'}
                </button>
                <p role="status" className="mt-3 text-center text-xs text-slate-500">{result ? '已收到服务端保存确认' : busy ? '请勿重复提交' : '提交前不会保存；成功测算按当前会员权益计次'}</p>
            </form>
            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="font-bold">这次估算能告诉您什么</h2>
                <ul className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                    <li>首年发电量：根据历史水平面辐照和综合效率估算。</li>
                    <li>回收可能：结合初始投入、运维费和逐年衰减计算。</li>
                    <li>核对依据：结果列出资料覆盖期、获取日期与假设。</li>
                </ul>
                <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-500">暂不模拟贷款、税费、组件倾角、设备更换与储能。需要更细的工程方案时，请补充现场勘察和专业设计。</p>
            </aside>
        </div>
        {result && submitted && <section aria-label="光伏初步估算结果" className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 sm:p-7">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="text-emerald-600" size={22} />初步估算已保存</h2>
            <p className="break-all text-xs text-slate-500">计算记录编号：{result.snapshotId}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                    ['初始投资', `${number(result.result.initialInvestment)} 元`],
                    ['首年估算发电量', `${number(result.result.annualGeneration)} 度`],
                    ['静态回收期', result.result.paybackPeriod === null ? '估算期内未回本' : `${number(result.result.paybackPeriod)} 年`],
                    ['内部收益率', result.result.irr === null ? '无法确认唯一值' : `${number(result.result.irr)}%`],
                    ['净现值', `${number(result.result.npv)} 元`],
                    ['平准化度电成本', `${number(result.result.lcoe, 3)} 元／度`],
                ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 break-words font-semibold">{value}</div></div>)}
            </div>
            <p className="text-sm leading-7 text-slate-600">内部收益率用于比较这组现金流的收益水平；净现值为按假设折现率折算后的净收益，可能为负。度电成本为折现后的成本与发电量之比。</p>
            <div className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-slate-700">
                <h3 className="font-semibold">数据与输入依据</h3>
                <p>美国航空航天局能源气象数据库：{date(result.source.start)} 至 {date(result.source.end)}；获取日期：{date(result.source.fetchedAt)}。</p>
                <p>位置：纬度 {submitted.lat}、经度 {submitted.lng}；装机 {submitted.capacity} 千瓦；单位投资 {submitted.unitCost} 元／千瓦；电价 {submitted.electricityPrice} 元／度（用户输入，未核验政策）。</p>
                <p className="break-all text-xs">来源数据校验值：{result.source.hash}</p>
            </div>
            <p className="text-sm leading-7 text-slate-600">估算期 {result.assumptions.lifetime} 年；综合效率 {number(result.assumptions.performanceRatio * 100)}%；年运维费为初始投资的 {number(result.assumptions.annualOperatingCostRatio * 100)}%；年衰减 {number(result.assumptions.degradationRate * 100)}%；折现率 {number(result.assumptions.discountRate * 100)}%。</p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{result.limitations.map(item => <li key={item}>{item}</li>)}</ul>
        </section>}
    </div>;
}
