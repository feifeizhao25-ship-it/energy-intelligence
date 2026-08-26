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
    ShieldCheck
} from 'lucide-react';

const steps = [
    {
        title: "欢迎来到新能源智库",
        description: "您的人工智能新能源智库。在这里，我们将复杂的工程计算转化为精准的商业决策。",
        icon: <Zap className="w-8 h-8 text-blue-500" />,
        color: "bg-blue-50"
    },
    {
        title: "精准的资源评估",
        description: "点击'资源地图'，获取全球任意经纬度 40 年间的 NASA 历史气象数据，为选址提供坚实基础。",
        icon: <Target className="w-8 h-8 text-emerald-500" />,
        color: "bg-emerald-50"
    },
    {
        title: "工程级财务建模",
        description: "使用'收益测算'工具。只需 3 分钟，即可获得包含 IRR、NPV 和 LCOE 的导出级专业报告。",
        icon: <BarChart3 className="w-8 h-8 text-blue-600" />,
        color: "bg-blue-50"
    },
    {
        title: "AI 运维诊断",
        description: "遇到电站异常？上传数据或 IV 曲线，我们的 AI 2.0 引擎将为您提供专家级修复指南。",
        icon: <ShieldCheck className="w-8 h-8 text-indigo-500" />,
        color: "bg-indigo-50"
    }
];

const STORAGE_KEY = 'hasSeenOnboarding_v1';

/**
 * 首访引导：底部悬浮卡片（不遮挡主内容、无全屏遮罩），
 * 可随时关闭，关闭状态持久化到 localStorage。
 */
export default function OnboardingFlow() {
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem(STORAGE_KEY);
        if (!hasSeenOnboarding) {
            setIsVisible(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-xl px-4 pointer-events-none">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative"
                role="dialog"
                aria-label="新手引导"
            >
                <button
                    onClick={handleClose}
                    aria-label="关闭引导"
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-5 sm:p-6 flex items-start gap-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -16 }}
                            className="flex items-start gap-4"
                        >
                            <div className={`w-14 h-14 ${steps[currentStep].color} rounded-2xl flex items-center justify-center shrink-0 shadow-inner`}>
                                {steps[currentStep].icon}
                            </div>
                            <div className="space-y-1.5 pr-6">
                                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                    {steps[currentStep].title}
                                </h2>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {steps[currentStep].description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="px-5 sm:px-6 pb-5 flex items-center justify-between">
                    <div className="flex gap-1.5">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-blue-600' : 'w-2 bg-slate-200'
                                    }`}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClose}
                            className="px-3 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            跳过
                        </button>
                        {currentStep > 0 && (
                            <button
                                onClick={prevStep}
                                aria-label="上一步"
                                className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all text-slate-600"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={nextStep}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-1.5"
                        >
                            {currentStep === steps.length - 1 ? '开始使用' : '继续'}
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
