'use client';

import React from 'react';
import {
    X,
    Sparkles,
    Check,
    FileText,
    BarChart3,
    ShieldCheck,
    Download,
    Zap,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    isLoading?: boolean;
    projectName?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    projectName = '项目评估报告'
}) => {
    if (!isOpen) return null;

    const features = [
        { title: '全生命周期财务模型', desc: '包含 25 年详细现金流及敏感性分析', icon: BarChart3 },
        { title: '高精度资源评估', desc: '基于 P50/P90 的气象数据及遮挡损耗模型', icon: Zap },
        { title: '工程级导出格式', desc: '支持 PDF/PPT/Excel 一键导出，直接交付', icon: Download },
        { title: '合规性建议', desc: '自动化排查当地电网接入及土地利用合规性', icon: ShieldCheck },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                {/* Header Photo/Decor */}
                <div className="h-32 bg-gradient-to-br from-green-500 to-emerald-600 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white blur-3xl rounded-full -ml-16 -mt-16" />
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white blur-3xl rounded-full -mr-16 -mb-16" />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <Sparkles className="w-10 h-10 mb-2 opacity-50" />
                        <h3 className="text-xl font-black">解锁工程级报告</h3>
                        <p className="text-white/70 text-xs">即刻获取《${projectName}》深度分析</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid gap-4">
                        {features.map((f, i) => (
                            <div key={i} className="flex gap-4">
                                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <f.icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white text-sm">{f.title}</div>
                                    <div className="text-xs text-slate-400 leading-relaxed">{f.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="text-xs text-slate-400 line-through">原价 ¥199.00</div>
                                <div className="text-3xl font-black text-slate-900 dark:text-white">
                                    ¥39.00 <small className="text-sm font-bold text-green-500 tracking-normal">/ 份</small>
                                </div>
                            </div>
                            <div className="bg-green-100 text-green-600 text-[10px] font-black px-2 py-1 rounded-lg">
                                限时 2 折
                            </div>
                        </div>

                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-bold rounded-[1.25rem] shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 transition-all group"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    立即解锁报告
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                        <p className="text-center text-[10px] text-slate-400 mt-4">
                            购买即代表您同意《服务协议》及《隐私条款》
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
