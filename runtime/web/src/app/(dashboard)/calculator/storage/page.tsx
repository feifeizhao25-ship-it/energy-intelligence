'use client';

import React, { useState } from 'react';
import { readCalculationResponse } from '@/lib/calculator/client-response';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Battery, Calculator, Loader2 } from 'lucide-react';
import { safeErrorMessage } from '@/lib/api/safe-error';
import TariffPriceFields, { describePricing, TARIFF_PROVINCES, type PriceKey } from '@/components/calculator/TariffPriceFields';
import type { PricingInfo } from '@/lib/pricing/tariff-defaults';

/**
 * 储能套利测算。
 * 原来页面写死「江苏」和峰 1.1 / 谷 0.3 / 平 0.6 元/度，用户看不到也改不了；结果跳到通用结果页后
 * 因为储能结果没有发电量字段，只显示「计算结果不完整」。现在：选省份 → 电价默认取省级电价表（显示来源状态）、
 * 可逐项改成自己的电价 → 结果直接显示在本页。
 */

interface StorageResult {
    technical: { usableEnergy: number; dailyCycles: number; operatingDays?: number; estimatedLifeDays?: number };
    assumptions?: string[];
    ranges?: Record<string, { low: number | null; median: number | null; high: number | null; relUncertainty: number; note: string }>;
    financial: {
        metrics: { dailyRevenue: number; annualRevenue: number; irr: number | null; lcos: number; paybackYears: number | null; npv: number };
        investment: { total: number; unitCost?: number };
        cashFlows?: number[];
    };
    pricing?: PricingInfo;
}

const fmt = (v: number, digits = 0) => Number.isFinite(v) ? v.toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';

export default function StorageCalculatorPage() {
    const router = useRouter();
    const [isCalculating, setIsCalculating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [result, setResult] = useState<StorageResult | null>(null);

    const [formData, setFormData] = useState({
        capacity: 1000, // kW
        energy: 2000, // kWh
        unitCost: 1500, // 元/kWh
        province: '江苏',
    });
    const [prices, setPrices] = useState<Partial<Record<PriceKey, string>>>({});

    const priceNumber = (key: PriceKey) => (prices[key] ?? '').trim() === '' ? undefined : Number(prices[key]);

    const handleCalculate = async () => {
        if (isCalculating) return;
        setErrorMessage('');
        setResult(null);
        if (!Number.isFinite(formData.capacity) || formData.capacity <= 0 || !Number.isFinite(formData.energy) || formData.energy <= 0) {
            setErrorMessage('请填写大于零的有效参数。');
            return;
        }
        setIsCalculating(true);
        try {
            const response = await fetch('/api/calculator/storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    capacity: formData.capacity,
                    energy: formData.energy,
                    batteryType: 'lithium',
                    applicationMode: 'arbitrage',
                    location: { province: formData.province },
                    // 只提交你自己填写的电价；没填的由服务端按省级电价表取
                    arbitrageConfig: { peakPrice: priceNumber('peak'), valleyPrice: priceNumber('valley') },
                    investment: { unitCost: formData.unitCost, financing: 'cash' },
                    technical: { efficiency: 88, dod: 90, cycleLife: 6000, degradationRate: 2, maintenanceCostRatio: 1.5 }
                })
            });
            setResult(await readCalculationResponse(response) as StorageResult);
        } catch (error) {
            setErrorMessage(error instanceof TypeError
                ? '网络连接失败，请检查网络后重试。'
                : safeErrorMessage(error, '测算失败，请稍后重试。'));
        } finally {
            setIsCalculating(false);
        }
    };

    const numberField = (key: 'capacity' | 'energy' | 'unitCost', label: string) => (
        <div className="space-y-2">
            <label htmlFor={`storage-${key}`} className="text-xs font-bold text-slate-400 leading-loose">{label}</label>
            <input id={`storage-${key}`} type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData[key]}
                onChange={e => { setResult(null); setFormData({ ...formData, [key]: parseFloat(e.target.value) }); }} />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
            {/* 手机上不吸顶：站点顶栏已固定在上方，两条吸顶栏会叠在一起挡住内容 */}
            <div className="sm:sticky sm:top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> 返回
                    </button>
                    <div className="flex items-center gap-2">
                        <Battery className="w-5 h-5 text-emerald-400" />
                        <span className="font-bold text-white tracking-tight">储能峰谷套利测算</span>
                    </div>
                    <div className="w-20" />
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 space-y-8">
                    <h2 className="text-xl font-bold text-white">系统规格</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {numberField('capacity', '功率容量（千瓦）')}
                        {numberField('energy', '能量容量（千瓦时）')}
                        {numberField('unitCost', '单位造价（元/千瓦时）')}
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-white">电价</h2>
                        <label className="block space-y-2 text-sm">
                            <span className="block text-xs font-bold text-slate-400">项目所在省份</span>
                            <select value={formData.province} onChange={e => { setResult(null); setFormData({ ...formData, province: e.target.value }); }}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white">
                                {TARIFF_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                                <option value="其他">其他省份（自己填写电价）</option>
                            </select>
                        </label>
                        <TariffPriceFields
                            province={formData.province}
                            fields={[
                                { key: 'peak', label: '峰时电价（放电）' },
                                { key: 'valley', label: '谷时电价（充电）' },
                            ]}
                            values={prices}
                            onChange={(key, value) => { setResult(null); setPrices({ ...prices, [key]: value }); }}
                        />
                        <p className="text-[11px] leading-5 text-slate-500">按每天一次「谷时充电、峰时放电」估算（充放电效率 88%），未考虑各省现货价格波动与需量电费；实际充放电窗口请按当地现行分时文件或合同确认。</p>
                    </div>

                    {errorMessage && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-sm leading-6 text-red-200">{errorMessage}</p>}
                    <button onClick={handleCalculate} disabled={isCalculating} className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2">
                        {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        执行测算
                    </button>
                </div>

                {result && (
                    <section aria-label="储能测算结果" data-testid="storage-result" className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-8 space-y-5">
                        <h2 className="text-xl font-bold text-white">测算结果（初步估算）</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                ['初始投资', `${fmt(result.financial.investment.total)} 元`],
                                ['每日套利收益', `${fmt(result.financial.metrics.dailyRevenue)} 元`],
                                ['年收益（按 330 天）', `${fmt(result.financial.metrics.annualRevenue)} 元`],
                                ['内部收益率', result.financial.metrics.irr === null || !Number.isFinite(result.financial.metrics.irr) ? '无法确认唯一值' : `${fmt(result.financial.metrics.irr, 2)}%`],
                                ['静态回收期', result.financial.metrics.paybackYears === null ? '评估期内未回本' : `${fmt(result.financial.metrics.paybackYears, 1)} 年`],
                                ['净现值（折现后的净收益）', `${fmt(result.financial.metrics.npv, 2)} 元`],
                                ['平准化储能成本（每度电成本）', `${fmt(result.financial.metrics.lcos, 3)} 元/度`],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-slate-800/60 p-4">
                                    <div className="text-xs text-slate-400">{label}</div>
                                    <div className="mt-1 font-bold text-white break-words">{value}</div>
                                </div>
                            ))}
                        </div>
                        <section aria-label="技术参数与计算假设" className="space-y-3">
                            <h3 className="font-bold text-white">这次结果怎么算出来</h3>
                            <p className="text-sm leading-7 text-slate-300">可用电量 {fmt(result.technical.usableEnergy, 2)} 千瓦时；每日循环 {fmt(result.technical.dailyCycles, 2)} 次；每年运行 {fmt(result.technical.operatingDays ?? 330)} 天。</p>
                            {result.technical.estimatedLifeDays !== undefined && <p className="text-sm text-slate-300">按循环次数估算的运行寿命：{fmt(result.technical.estimatedLifeDays)} 个运行日；这不是日历寿命或设备质保承诺。</p>}
                            {result.financial.investment.unitCost !== undefined && <p className="text-sm text-slate-300">单位投资：{fmt(result.financial.investment.unitCost, 2)} 元／千瓦时。</p>}
                            <ul className="list-disc pl-5 space-y-2 text-sm leading-7 text-slate-300">{result.assumptions?.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </section>
                        {result.ranges && <section aria-label="敏感性估算区间" className="space-y-3">
                            <h3 className="font-bold text-white">条件变化时，结果可能怎样变化</h3>
                            <p className="text-sm leading-7 text-slate-300">以下是模型假设变化的敏感性区间，不是保证收益或统计置信区间。</p>
                            {Object.entries(result.ranges).map(([key, range]) => {
                                const label = ({ annualRevenue: '年套利收益（元）', irr: '内部收益率（百分比）', lcos: '每度电储能成本（元／度）' } as Record<string, string>)[key] || '其他测算指标';
                                const value = (number: number | null) => number === null ? '无法确认唯一值' : fmt(number, 3);
                                return <div key={key} className="rounded-xl bg-slate-800/60 p-4 space-y-2 text-sm leading-7">
                                    <h4 className="font-bold text-white">{label}</h4>
                                    <p>低值 {value(range.low)}；基准 {value(range.median)}；高值 {value(range.high)}。</p>
                                    <p>假设扰动比例：{fmt(range.relUncertainty * 100, 2)}%。{range.note}</p>
                                </div>;
                            })}
                        </section>}
                        {result.financial.cashFlows && <section aria-label="完整年度现金流" className="space-y-3">
                            <h3 className="font-bold text-white">全部年度现金流</h3>
                            <p className="text-sm leading-7 text-slate-300">第0年为初始投入，负数表示支出。后续金额已按本次模型扣除运维费用并计入衰减。展示全部年份，不省略中间年份。</p>
                            <div className="max-w-full overflow-x-auto">
                            <table className="w-full min-w-[20rem] text-left text-sm" data-testid="storage-cashflows">
                                <thead><tr><th className="py-3">年份</th><th className="py-3">净现金流（元）</th></tr></thead>
                                <tbody>{result.financial.cashFlows.map((amount, year) => <tr key={year} className="border-t border-slate-700"><th scope="row" className="py-3 font-normal">第{year}年</th><td className="py-3 break-all">{fmt(amount, 2)}</td></tr>)}</tbody>
                            </table>
                            </div>
                        </section>}
                        <p className="text-xs leading-6 text-slate-400" data-testid="storage-pricing">{describePricing(result.pricing)}</p>
                        <p className="text-xs leading-6 text-slate-500">评估期 10 年，每年运行 330 天；未计税费、融资、容量补偿与辅助服务收益，不构成投资建议。</p>
                    </section>
                )}
            </main>
        </div>
    );
}
