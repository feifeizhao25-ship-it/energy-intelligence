'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { shouldShowOnboardingTip, TIP_DISMISSED_KEY, TIP_SNOOZED_KEY } from './onboarding-tip';
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
        description: "在这里，发电量与收益测算的假设和数据来源都会列清楚，帮你做初步判断；结果仅供参考。",
        icon: <Zap className="w-8 h-8 text-blue-500" />,
        color: "bg-blue-50"
    },
    {
        title: "资源查询",
        description: "点击'资源地图'，查询任意经纬度的公开历史气象数据，作为选址的参考。",
        icon: <Target className="w-8 h-8 text-emerald-500" />,
        color: "bg-emerald-50"
    },
    {
        title: "收益测算",
        description: "使用'收益测算'工具。填写位置、装机和电价，得到包含内部收益率、净现值和度电成本的初步测算，可导出报告。",
        icon: <BarChart3 className="w-8 h-8 text-blue-600" />,
        color: "bg-blue-50"
    },
    {
        title: "AI 运维诊断",
        description: "遇到电站异常？上传数据或 IV 曲线，AI 会给出排查建议（仅供参考，处理前请由专业人员确认）。",
        icon: <ShieldCheck className="w-8 h-8 text-indigo-500" />,
        color: "bg-indigo-50"
    }
];

/**
 * 首访引导（审计 10-1）：右下角小提示气泡，不是对话框、无遮罩，测算页不弹出，
 * 避免盖住“开始计算”等主按钮。“不再显示”永久记住，“稍后”仅本次会话隐藏。
 */
export default function OnboardingFlow() {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        setIsVisible(shouldShowOnboardingTip(pathname, window.localStorage, window.sessionStorage));
    }, [pathname]);

    const handleClose = () => {
        localStorage.setItem(TIP_DISMISSED_KEY, 'true');
        setIsVisible(false);
    };

    const handleSnooze = () => {
        sessionStorage.setItem(TIP_SNOOZED_KEY, 'true');
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
        <div className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm pointer-events-none" data-testid="onboarding-tip">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative"
                role="status"
                aria-label="新手提示"
            >
                <button
                    onClick={handleSnooze}
                    aria-label="稍后再看"
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="p-4 flex items-start gap-3">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -16 }}
                            className="flex items-start gap-4"
                        >
                            <div className={`w-10 h-10 ${steps[currentStep].color} rounded-2xl flex items-center justify-center shrink-0 shadow-inner`}>
                                {steps[currentStep].icon}
                            </div>
                            <div className="space-y-1.5 pr-6">
                                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                                    {steps[currentStep].title}
                                </h2>
                                <p className="text-slate-600 text-sm leading-relaxed">
                                    {steps[currentStep].description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="px-4 pb-4 flex items-center justify-between">
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
                            不再显示
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
