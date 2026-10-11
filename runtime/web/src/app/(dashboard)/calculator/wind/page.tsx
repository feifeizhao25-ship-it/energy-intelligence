'use client';

import React, { useState } from 'react';
import { readCalculationResponse } from '@/lib/calculator/client-response';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Wind, MapPin, Settings, PieChart, BarChart3, Calculator, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationPicker from '@/components/map/LocationPicker';
import { safeErrorMessage } from '@/lib/api/safe-error';
import TariffPriceFields, { TARIFF_PROVINCES } from '@/components/calculator/TariffPriceFields';
import { normalizeProvince } from '@/lib/pricing/tariffs';

export default function WindCalculatorPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isCalculating, setIsCalculating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [formData, setFormData] = useState({
        lat: 39.9042,
        lng: 116.4074,
        province: '北京',
        turbineType: 'medium_wind',
        capacity: 3.0, // MW
        count: 1,
        hubHeight: 110,
        rotorDiameter: 160,
        businessMode: 'full_export',
        cooperationMode: 'rental',
        unitCost: 6500, // 元/kW
    });
    // 上网电价：留空 = 按所选省份电价表的燃煤发电基准价参考；填了 = 用你的机制电价或合同价
    const [feedInTariff, setFeedInTariff] = useState('');

    const handleCalculate = async () => {
        if (isCalculating) return;
        setErrorMessage('');
        if (!Number.isFinite(formData.capacity) || formData.capacity <= 0 || !Number.isFinite(formData.hubHeight) || formData.hubHeight <= 0) {
            setErrorMessage('请填写大于零的有效参数。');
            return;
        }
        setIsCalculating(true);
        try {
            const response = await fetch('/api/calculator/wind', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    turbine: {
                        type: formData.turbineType,
                        capacity: formData.capacity,
                        count: formData.count,
                        hubHeight: formData.hubHeight,
                        rotorDiameter: formData.rotorDiameter,
                        cutInSpeed: 3.0,
                        ratedSpeed: 10.5,
                        cutOutSpeed: 25.0
                    },
                    businessModel: {
                        mode: formData.businessMode,
                        cooperationMode: formData.cooperationMode,
                        ...(feedInTariff.trim() ? { feedInTariff: Number(feedInTariff) } : {})
                    },
                    investment: { unitCost: formData.unitCost },
                    operation: {}
                })
            });
            const data = await readCalculationResponse(response) as Record<string, any>;
            // 结果页「核心参数回顾」与电价说明读 metadata：省份、装机（kW）、电价来源都带过去
            const province = normalizeProvince(formData.province) || formData.province;
            const withMeta = {
                ...data,
                metadata: {
                    projectName: `${province}分散式风电项目`,
                    province,
                    capacity: Math.round(formData.capacity * formData.count * 1000),
                    pricing: data.pricing,
                },
            };
            router.push(`/calculator/result?type=wind&data=${encodeURIComponent(JSON.stringify(withMeta))}`);
        } catch (error) {
            setErrorMessage(error instanceof TypeError
                ? '网络连接失败，请检查网络后重试。'
                : safeErrorMessage(error, '测算失败，请稍后重试。'));
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
            {/* 手机上不吸顶：站点顶栏已固定在上方，两条吸顶栏会叠在一起挡住内容 */}
            <div className="sm:sticky sm:top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> 返回
                    </button>
                    <div className="flex items-center gap-2">
                        <Wind className="w-5 h-5 text-blue-400" />
                        <span className="font-bold text-white tracking-tight">分散式风电收益测算</span>
                    </div>
                    <div className="w-20" />
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 mt-12">
                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">位置与省份选择</h2>
                                <div className="mb-4">
                                    <LocationPicker
                                        value={{ lat: formData.lat.toString(), lng: formData.lng.toString(), province: formData.province }}
                                        onChange={v => setFormData({ ...formData, lat: v.lat, lng: v.lng, province: v.province || formData.province })}
                                    />
                                </div>
                                <p data-testid="wind-location-summary" className="text-sm leading-6 text-slate-300">
                                    当前位置：纬度 {Number(formData.lat).toFixed(4)}，经度 {Number(formData.lng).toFixed(4)}；省份：{formData.province || '未选择'}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">位置用于读取历史风速；省份用于下一步的上网电价参考，可在下一步修改。</p>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 2 && (
                        <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">风机参数配置</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400">单机容量（兆瓦）</label>
                                        <input type="number" step="0.5" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: parseFloat(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400">轮毂高度（米）</label>
                                        <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData.hubHeight} onChange={e => setFormData({ ...formData, hubHeight: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
                                <h2 className="text-xl font-bold text-white">上网电价</h2>
                                <label className="block space-y-2 text-sm">
                                    <span className="block text-xs font-bold text-slate-400">电价按哪个省份取</span>
                                    <select value={TARIFF_PROVINCES.includes(normalizeProvince(formData.province)) ? normalizeProvince(formData.province) : '其他'}
                                        onChange={e => setFormData({ ...formData, province: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white">
                                        {TARIFF_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                                        <option value="其他">其他省份（自己填写电价）</option>
                                    </select>
                                </label>
                                <TariffPriceFields
                                    province={normalizeProvince(formData.province)}
                                    fields={[{ key: 'coalBenchmarkPrice', label: '上网电价（机制电价或合同价）' }]}
                                    values={{ coalBenchmarkPrice: feedInTariff }}
                                    onChange={(_, value) => setFeedInTariff(value)}
                                    showFeedInBasis
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 报错放在「执行计算」按钮旁边：点完按钮就能看到原因，不用滚回页面顶部 */}
                {errorMessage && <p role="alert" className="mt-6 rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-sm leading-6 text-red-200">{errorMessage}</p>}
                <div className="mt-6 sm:mt-12 flex justify-between">
                    <button onClick={() => setCurrentStep(prev => prev - 1)} className={`px-8 py-3 rounded-xl border border-slate-700 text-slate-400 ${currentStep === 1 ? 'invisible' : ''}`}>上一步</button>
                    {currentStep < 2 ? (
                        <button onClick={() => setCurrentStep(prev => prev + 1)} className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">下一步 <ArrowRight className="w-4 h-4" /></button>
                    ) : (
                        <button onClick={handleCalculate} disabled={isCalculating} className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
                            {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                            执行计算
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
}
