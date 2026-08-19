'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRight,
    MapPin,
    Zap,
    Settings,
    BarChart3,
    PieChart,
    Calculator,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LocationPicker from '@/components/map/LocationPicker';
import { useUsageLimitToast, UpgradeModal, UsageLimitToast } from '@/components/paywall';

const STEPS = [
    { id: 1, title: '位置与资源', icon: <MapPin className="w-5 h-5" /> },
    { id: 2, title: '技术参数', icon: <Settings className="w-5 h-5" /> },
    { id: 3, title: '商业模式', icon: <PieChart className="w-5 h-5" /> },
    { id: 4, title: '投资估算', icon: <BarChart3 className="w-5 h-5" /> },
];

export default function SolarCalculatorPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [currentStep, setCurrentStep] = useState(1);
    const [isCalculating, setIsCalculating] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const { toastState, showLimitToast, hideLimitToast } = useUsageLimitToast();

    // 表单数据
    const [formData, setFormData] = useState({
        projectName: '',
        lat: 39.9042,
        lng: 116.4074,
        province: '北京',
        capacity: 100, // kW
        moduleType: 'standard',
        installationType: 'roof',
        tilt: 35,
        azimuth: 180,
        businessMode: 'self_use_export',
        selfUseRatio: 30,
        electricityPrice: 0.65,
        feedInTariff: 0.45,
        unitCost: 3500, // 元/kWp
        financing: 'cash',
        loanRatio: 70,
        loanRate: 4.5
    });

    useEffect(() => {
        // 处理来自地图的地理同步
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');
        const province = searchParams.get('province');
        if (lat && lng) {
            setFormData(prev => ({
                ...prev,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                province: province || prev.province
            }));
        }
    }, [searchParams]);

    const handleCalculate = async () => {
        // 1. 检查限制 (这里简单模拟，实际应从 fetch 获取最新 usage)
        const canCalculate = true; // 假设通过
        if (!canCalculate) {
            showLimitToast('资源测算', 0, 5);
            setShowUpgradeModal(true);
            return;
        }

        setIsCalculating(true);
        try {
            const response = await fetch('/api/calculator/solar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (result.success) {
                // 跳转到结果页，带上结果ID或状态
                // 模拟存储结果并跳转
                const resultWithMeta = {
                    ...result.data,
                    metadata: {
                        projectName: formData.projectName,
                        province: formData.province,
                        capacity: formData.capacity
                    }
                };
                router.push(`/calculator/result?type=solar&data=${encodeURIComponent(JSON.stringify(resultWithMeta))}`);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
            {/* Top Header */}
            <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        返回
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="font-bold text-white tracking-tight">分布式光伏测量 2.0</span>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">已保存至云端</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="max-w-5xl mx-auto px-6 pb-4">
                    <div className="flex justify-between mt-4">
                        {STEPS.map((step) => (
                            <div
                                key={step.id}
                                className={`flex flex-col items-center gap-2 flex-1 relative ${currentStep >= step.id ? 'text-blue-400' : 'text-slate-600'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${currentStep >= step.id ? 'bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-800 border-slate-700'
                                    }`}>
                                    {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{step.title}</span>

                                {/* Connector */}
                                {step.id < 4 && (
                                    <div className="absolute top-4 left-[calc(50%+1rem)] w-[calc(100%-2rem)] h-[2px] bg-slate-800">
                                        <motion.div
                                            className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: currentStep > step.id ? '100%' : '0%' }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 mt-12">
                <AnimatePresence mode="wait">
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">项目基本信息</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">项目名称</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-white"
                                            placeholder="例如：苏州工厂屋顶300kW光伏项目"
                                            value={formData.projectName}
                                            onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">所在省份</label>
                                        <select
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-white"
                                            value={formData.province}
                                            onChange={e => setFormData({ ...formData, province: e.target.value })}
                                        >
                                            {['北京', '上海', '江苏', '浙江', '山东', '河北', '广东'].map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                                <div className="p-8 pb-4">
                                    <h2 className="text-xl font-bold text-white flex items-center justify-between">
                                        地理位置选点
                                        <span className="text-xs font-normal text-slate-500">点击地图选取项目中心位置</span>
                                    </h2>
                                </div>
                                <div className="h-[400px] w-full relative">
                                    <LocationPicker
                                        value={{ lat: formData.lat.toString(), lng: formData.lng.toString(), province: formData.province }}
                                        onChange={v => setFormData({ ...formData, lat: v.lat, lng: v.lng, province: v.province || formData.province })}
                                    />
                                </div>
                                <div className="p-6 bg-slate-900/50 flex gap-12 border-t border-slate-800">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">经度</div>
                                        <div className="text-white font-mono">{formData.lng.toFixed(6)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">纬度</div>
                                        <div className="text-white font-mono">{formData.lat.toFixed(6)}</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">技术规格定义</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">装机容量 (kWp)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-white"
                                                value={formData.capacity}
                                                onChange={e => setFormData({ ...formData, capacity: parseFloat(e.target.value) })}
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">kWp</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">组件类型</label>
                                        <select
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-white"
                                            value={formData.moduleType}
                                            onChange={e => setFormData({ ...formData, moduleType: e.target.value })}
                                        >
                                            <option value="economy">经济型 (效率 21.0%)</option>
                                            <option value="standard">标准型 (效率 22.5%)</option>
                                            <option value="premium">旗舰型 (效率 23.8%)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">安装方式</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'roof', label: '屋顶安装' },
                                                { id: 'ground', label: '地面电站' },
                                                { id: 'carport', label: '光伏车棚' },
                                                { id: 'bifacial', label: '双面组件' }
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setFormData({ ...formData, installationType: type.id })}
                                                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${formData.installationType === type.id
                                                        ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                                        }`}
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">最佳倾角 (°)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                                value={formData.tilt}
                                                onChange={e => setFormData({ ...formData, tilt: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">朝向角 (°)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                                value={formData.azimuth}
                                                onChange={e => setFormData({ ...formData, azimuth: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">商业模式配置</h2>
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">消纳模式</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setFormData({ ...formData, businessMode: 'self_use_export' })}
                                                className={`p-5 rounded-2xl border flex flex-col gap-2 text-left transition-all ${formData.businessMode === 'self_use_export'
                                                    ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                                                    : 'bg-slate-800 border-slate-700'
                                                    }`}
                                            >
                                                <div className={`font-bold ${formData.businessMode === 'self_use_export' ? 'text-white' : 'text-slate-300'}`}>自发自用，余电上网</div>
                                                <div className="text-xs text-slate-500 leading-relaxed">最常见的工商业模式，收益受自用比例影响。</div>
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, businessMode: 'full_export' })}
                                                className={`p-5 rounded-2xl border flex flex-col gap-2 text-left transition-all ${formData.businessMode === 'full_export'
                                                    ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
                                                    : 'bg-slate-800 border-slate-700'
                                                    }`}
                                            >
                                                <div className={`font-bold ${formData.businessMode === 'full_export' ? 'text-white' : 'text-slate-300'}`}>全额上网</div>
                                                <div className="text-xs text-slate-500 leading-relaxed">所有发电量以基准标杆电价卖给电网。</div>
                                            </button>
                                        </div>
                                    </div>

                                    {formData.businessMode === 'self_use_export' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">自用比例 (%)</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                                        value={formData.selfUseRatio}
                                                        onChange={e => setFormData({ ...formData, selfUseRatio: parseInt(e.target.value) })}
                                                    />
                                                    <span className="w-12 text-center text-white font-mono">{formData.selfUseRatio}%</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">购电电价 (元/kWh)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                                    value={formData.electricityPrice}
                                                    onChange={e => setFormData({ ...formData, electricityPrice: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">脱硫煤标杆电价 (元/kWh)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                            value={formData.feedInTariff}
                                            onChange={e => setFormData({ ...formData, feedInTariff: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-white mb-6">投资与融资建议</h2>
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">单位造价 (元/Wp)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                                value={formData.unitCost / 1000}
                                                onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) * 1000 })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">预计总投资 (万元)</label>
                                            <div className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-400 font-bold">
                                                {(formData.capacity * formData.unitCost / 10000).toFixed(2)} 万元
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">资金渠道</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setFormData({ ...formData, financing: 'cash' })}
                                                className={`p-4 rounded-xl border transition-all ${formData.financing === 'cash'
                                                    ? 'bg-orange-500/10 border-orange-500 text-white'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                                    }`}
                                            >
                                                全款自有资金
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, financing: 'loan' })}
                                                className={`p-4 rounded-xl border transition-all ${formData.financing === 'loan'
                                                    ? 'bg-orange-500/10 border-orange-500 text-white'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                                    }`}
                                            >
                                                银行融资贷款
                                            </button>
                                        </div>
                                    </div>

                                    {formData.financing === 'loan' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">贷款比例 (%)</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                                    value={formData.loanRatio}
                                                    onChange={e => setFormData({ ...formData, loanRatio: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-loose">贷款利率 / LPR+ ( % )</label>
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white"
                                                    value={formData.loanRate}
                                                    onChange={e => setFormData({ ...formData, loanRate: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Action Bar */}
                <div className="mt-12 flex justify-between">
                    <button
                        onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                        className={`px-8 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-all ${currentStep === 1 ? 'opacity-0 pointer-events-none' : ''
                            }`}
                    >
                        上一步
                    </button>

                    {currentStep < 4 ? (
                        <button
                            onClick={() => setCurrentStep(prev => prev + 1)}
                            className="px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-orange-900/20 transition-all hover:-translate-y-0.5"
                        >
                            下一步
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleCalculate}
                            disabled={isCalculating}
                            className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold flex items-center gap-2 shadow-xl shadow-orange-900/30 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                        >
                            {isCalculating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    建模计算中...
                                </>
                            ) : (
                                <>
                                    <Calculator className="w-4 h-4" />
                                    立即生成投资报告
                                </>
                            )}
                        </button>
                    )}
                </div>
            </main>

            {/* Info Tips */}
            <div className="max-w-4xl mx-auto px-6 mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="text-white text-sm font-bold mb-1">专业算法支撑</div>
                        <div className="text-slate-500 text-xs leading-relaxed">基于 PVSyst 5.0 的损耗模型进行修正，包含温度损失、DC 线损及逆变器效率。</div>
                    </div>
                </div>
                <div className="flex gap-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                    <AlertCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="text-white text-sm font-bold mb-1">气象数据库</div>
                        <div className="text-slate-500 text-xs leading-relaxed">实时调用 NASA POWER API 获取近25年日平均辐照量，精度优于 5%。</div>
                    </div>
                </div>
            </div>
            {/* Paywall Components */}
            <UsageLimitToast
                show={toastState.show}
                feature={toastState.feature}
                remaining={toastState.remaining}
                limit={toastState.limit}
                onClose={hideLimitToast}
                onUpgrade={() => setShowUpgradeModal(true)}
            />

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
            />
        </div>
    );
}
