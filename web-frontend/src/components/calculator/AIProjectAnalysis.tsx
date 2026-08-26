'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIAnalysisProps {
    type: string;
    data: any;
}

export default function AIProjectAnalysis({ type, data }: AIAnalysisProps) {
    const [analysis, setAnalysis] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        async function fetchAnalysis() {
            try {
                const res = await fetch('/api/calculator/analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, data }),
                });
                const result = await res.json();
                if (result.results) {
                    setAnalysis(result.results);
                } else {
                    setError(true);
                }
            } catch (err) {
                setError(true);
            } finally {
                setIsLoading(false);
            }
        }

        if (data) fetchAnalysis();
    }, [type, data]);

    return (
        <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-black text-white tracking-widest uppercase">AI 智能投资诊断</h4>
            </div>

            <AnimatePresence mode="wait">
                {isLoading ? (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10"
                    >
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        <span className="text-xs text-slate-500 font-medium">深度神经网络正在分析投资风险...</span>
                    </motion.div>
                ) : error ? (
                    <motion.div
                        key="error"
                        className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/10"
                    >
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-slate-500">分析暂时不可用，请稍后刷新。</span>
                    </motion.div>
                ) : (
                    <motion.div
                        key="content"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 rounded-2xl bg-slate-900 border border-blue-500/20 shadow-xl shadow-blue-900/10"
                    >
                        <div className="text-slate-300 text-xs leading-relaxed space-y-2 whitespace-pre-wrap font-medium">
                            {analysis}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-[10px] text-slate-600 font-black uppercase tracking-tighter">Powered by DeepSeek V3</div>
                            <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase">低风险评级</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
