'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Wind, MapPin, Settings, PieChart, BarChart3, Calculator, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationPicker from '@/components/map/LocationPicker';

export default function WindCalculatorPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isCalculating, setIsCalculating] = useState(false);

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

    const handleCalculate = async () => {
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
                        cooperationMode: formData.cooperationMode
                    },
                    investment: { unitCost: formData.unitCost },
                    operation: {}
                })
            });
            const result = await response.json();
            if (result.success) {
                router.push(`/calculator/result?type=wind&data=${encodeURIComponent(JSON.stringify(result.data))}`);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
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
                                <div className="h-[400px] rounded-2xl overflow-hidden mb-6 border border-slate-700">
                                    <LocationPicker
                                        value={{ lat: formData.lat.toString(), lng: formData.lng.toString(), province: formData.province }}
                                        onChange={v => setFormData({ ...formData, lat: v.lat, lng: v.lng, province: v.province || formData.province })}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 2 && (
                        <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">风机参数配置</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">单机容量 (MW)</label>
                                        <input type="number" step="0.5" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: parseFloat(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">轮毂高度 (m)</label>
                                        <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData.hubHeight} onChange={e => setFormData({ ...formData, hubHeight: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mt-12 flex justify-between">
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
