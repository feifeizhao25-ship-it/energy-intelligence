'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle2, Crown } from 'lucide-react';

interface UnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUnlock: () => void;
    title?: string;
    description?: string;
    price?: string;
}

export default function UnlockModal({
    isOpen,
    onClose,
    onUnlock,
    title = "解锁专业版功能",
    description = "获取无限次多点对比、PDF 报告导出及 AI 深度分析权限",
    price = "¥ 199 / 年"
}: UnlockModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl"
                >
                    {/* Header Image/Gradient */}
                    <div className="h-32 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-500 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg transform rotate-12">
                                <Crown className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white/70 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">{title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed px-4">{description}</p>
                        </div>

                        <div className="space-y-4 mb-8">
                            {[
                                '无限次 PDF 报告导出',
                                '全国 34 省份多点对比',
                                'AI 智能投资风险分析',
                                '优先专家咨询通道'
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-700">{item}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={onUnlock}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <Sparkles className="w-5 h-5" />
                            立即解锁 Pro ({price})
                        </button>

                        <p className="text-center mt-4 text-xs text-slate-400">
                            实际价格、续费与退款条件以下单确认页为准
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
