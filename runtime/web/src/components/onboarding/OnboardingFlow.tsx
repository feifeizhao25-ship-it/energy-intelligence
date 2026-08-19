'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    ChevronRight,
    ChevronLeft,
    Zap,
    Target,
    BarChart3,
    ShieldCheck,
    Sparkles
} from 'lucide-react';

const steps = [
    {
        title: "欢迎来到 SolarWind Pro",
        description: "您的人工智能新能源智库。在这里，我们将复杂的工程计算转化为精准的商业决策。",
        icon: <Zap className="w-12 h-12 text-blue-500" />,
        color: "bg-blue-50"
    },
    {
        title: "精准的资源评估",
        description: "点击'资源地图'，获取全球任意经纬度 40 年间的 NASA 历史气象数据，为选址提供坚实基础。",
        icon: <Target className="w-12 h-12 text-emerald-500" />,
        color: "bg-emerald-50"
    },
    {
        title: "工程级财务建模",
        description: "使用'收益测算'工具。只需 3 分钟，即可获得包含 IRR、NPV 和 LCOE 的导出级专业报告。",
        icon: <BarChart3 className="w-12 h-12 text-blue-600" />,
        color: "bg-blue-50"
    },
    {
        title: "AI 运维诊断",
        description: "遇到电站异常？上传数据或 IV 曲线，我们的 AI 2.0 引擎将为您提供专家级修复指南。",
        icon: <ShieldCheck className="w-12 h-12 text-indigo-500" />,
        color: "bg-indigo-50"
    }
];

export default function OnboardingFlow() {
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding_v1');
        if (!hasSeenOnboarding) {
            setIsVisible(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('hasSeenOnboarding_v1', 'true');
        setIsVisible(false);
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleClose();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden relative"
            >
                <button
                    onClick={handleClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400 group"
                >
                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </button>

                <div className="p-12 text-center">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className={`w-24 h-24 ${steps[currentStep].color} rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner`}>
                                {steps[currentStep].icon}
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                    {steps[currentStep].title}
                                </h2>
                                <p className="text-slate-600 text-lg leading-relaxed">
                                    {steps[currentStep].description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <div className="mt-12 flex items-center justify-between">
                        <div className="flex gap-1.5">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="flex gap-3">
                            {currentStep > 0 && (
                                <button
                                    onClick={prevStep}
                                    className="p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all font-bold text-slate-600 flex items-center gap-2"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={nextStep}
                                className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center gap-2 group"
                            >
                                {currentStep === steps.length - 1 ? '开始使用' : '继续'}
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 装饰元素 */}
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 -z-10"></div>
                <div className="absolute top-0 left-0 p-8">
                    <Sparkles className="w-6 h-6 text-blue-100" />
                </div>
            </motion.div>
        </div>
    );
}
