'use client';

import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Lightbulb, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecommendationCardProps {
    type: string;
    reason: string;
    explanation?: string;
    isLoading?: boolean;
    onUpgrade?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
    SOLAR: '分布式光伏',
    WIND: '分散式风电',
    STORAGE: '工商业储能',
    HYBRID: '光储一体化',
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
    type,
    reason,
    explanation,
    isLoading,
    onUpgrade
}) => {
    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full -mr-16 -mt-16" />

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-green-400">专家系统智能推荐</span>
                </div>

                <h3 className="text-2xl font-black mb-2">
                    首选方案：<span className="text-green-400">{TYPE_LABELS[type] || type}</span>
                </h3>

                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    {reason}
                </p>

                {explanation ? (
                    <div className="space-y-4 mb-6">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Lightbulb className="w-3 h-3 text-amber-400" />
                                AI 深度分析
                            </div>
                            <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {explanation}
                            </div>
                        </div>
                    </div>
                ) : isLoading ? (
                    <div className="space-y-2 mb-6 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-3/4" />
                        <div className="h-4 bg-white/10 rounded w-1/2" />
                    </div>
                ) : null}

                <button
                    onClick={onUpgrade}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 text-slate-900 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20 group"
                >
                    解锁完整工程级报告
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        报告符合行业标准
                    </div>
                    <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        支持 PDF/PPT 导出
                    </div>
                </div>
            </div>
        </div>
    );
};

import { FileText } from 'lucide-react';
