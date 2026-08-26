'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Battery, Settings, PieChart, Calculator, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StorageCalculatorPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [isCalculating, setIsCalculating] = useState(false);

    const [formData, setFormData] = useState({
        capacity: 1000, // kW
        energy: 2000, // kWh
        batteryType: 'lithium',
        applicationMode: 'arbitrage',
        unitCost: 1500, // 元/kWh
    });

    const handleCalculate = async () => {
        setIsCalculating(true);
        try {
            const response = await fetch('/api/calculator/storage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData, // Simplified
                    location: { province: '江苏', lat: 31, lng: 120 },
                    arbitrageConfig: { peakPrice: 1.1, valleyPrice: 0.3, flatPrice: 0.6 },
                    investment: { unitCost: formData.unitCost, financing: 'cash' },
                    technical: { efficiency: 88, dod: 90, cycleLife: 6000, degradationRate: 2, maintenanceCostRatio: 1.5 }
                })
            });
            const result = await response.json();
            if (result.success) {
                router.push(`/calculator/result?type=storage&data=${encodeURIComponent(JSON.stringify(result.data))}`);
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
                        <Battery className="w-5 h-5 text-emerald-400" />
                        <span className="font-bold text-white tracking-tight">能源存储系统测算</span>
                    </div>
                    <div className="w-20" />
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 mt-12">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8">
                    <h2 className="text-xl font-bold text-white">系统规格定义</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">功率容量 (kW)</label>
                            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData.capacity} onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">能量容量 (kWh)</label>
                            <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white" value={formData.energy} onChange={e => setFormData({ ...formData, energy: parseInt(e.target.value) })} />
                        </div>
                    </div>
                    <button onClick={handleCalculate} disabled={isCalculating} className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2">
                        {isCalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        执行测算
                    </button>
                </div>
            </main>
        </div>
    );
}
