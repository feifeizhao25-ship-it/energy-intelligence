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
    technical: { usableEnergy: number; dailyCycles: number };
    financial: {
        metrics: { dailyRevenue: number; annualRevenue: number; irr: number; lcos: number; paybackYears: number; npv: number };
        investment: { total: number };
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
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
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
                {errorMessage && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-red-200">{errorMessage}</p>}
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
                                ['内部收益率', `${fmt(result.financial.metrics.irr, 2)}%`],
                                ['静态回收期', `${fmt(result.financial.metrics.paybackYears, 1)} 年`],
                                ['度电储能成本', `${fmt(result.financial.metrics.lcos, 3)} 元/度`],
                            ].map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-slate-800/60 p-4">
                                    <div className="text-xs text-slate-400">{label}</div>
                                    <div className="mt-1 font-bold text-white break-words">{value}</div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs leading-6 text-slate-400" data-testid="storage-pricing">{describePricing(result.pricing)}</p>
                        <p className="text-xs leading-6 text-slate-500">评估期 10 年，每年运行 330 天；未计税费、融资、容量补偿与辅助服务收益，不构成投资建议。</p>
                    </section>
                )}
            </main>
        </div>
    );
}
