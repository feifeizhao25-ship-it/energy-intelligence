'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Grid,
    Search,
    AlertCircle,
    CheckCircle,
    ArrowRight,
    Loader2,
    TrendingUp
} from 'lucide-react';
import { StringAnalysis, StringAnalysisInput } from '@/lib/maintenance/types';
import { getStringAnalysisAction } from '@/app/actions/maintenance';

export default function FaultLocalizationView() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<StringAnalysis | null>(null);

    return (
        <div className="space-y-6">
            {/* Control Panel */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <Grid className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">组串级离散率分析</h2>
                            <p className="text-sm text-slate-500">IV 曲线特征扫描与精准定位</p>
                        </div>
                    </div>
                    <button
                        disabled
                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-bold text-sm shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2 disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        等待 SCADA 数据接入
                    </button>
                </div>

                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-sm text-orange-800 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>尚未接入组串级实测数据。系统不会使用随机数据生成故障结论；完成 SCADA/IoT 数据源配置后才可扫描。</p>
                </div>
            </div>

            {/* Results */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                    {/* Heatmap Visualization */}
                    <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                        <h3 className="font-bold text-slate-900 mb-6">组串状态热力图</h3>
                        <div className="grid grid-cols-4 gap-4">
                            {result.stringResults.map(s => (
                                <div
                                    key={s.id}
                                    className={`relative p-4 rounded-xl border-2 transition-all ${s.status === 'error' ? 'bg-red-50 border-red-500 text-red-600' :
                                        s.status === 'warning' ? 'bg-amber-50 border-amber-400 text-amber-600' :
                                            'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'
                                        }`}
                                >
                                    <div className="text-xs font-bold mb-1 opacity-70">{s.id}</div>
                                    <div className="text-lg font-black">{s.a.toFixed(1)}A</div>
                                    <div className="text-xs opacity-70">{s.v.toFixed(0)}V</div>

                                    {s.status !== 'normal' && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full border border-current flex items-center justify-center shadow-sm">
                                            <AlertCircle className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Diagnostics Panel */}
                    <div className="space-y-6">
                        {/* Summary Stats */}
                        <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                            <h3 className="font-bold text-slate-900 mb-4">异常诊断报告</h3>
                            {result.diagnostics.length > 0 ? (
                                <div className="space-y-4">
                                    {result.diagnostics.map((diag, i) => (
                                        <div key={i} className="bg-slate-50 rounded-xl p-4 border-l-4 border-slate-300">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-900">{diag.type}</h4>
                                                <span className="text-xs font-bold px-2 py-1 bg-white rounded border border-slate-200">
                                                    ID: {diag.stringId}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-600 mb-3 space-y-1">
                                                {diag.reasons.map((r, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                        {r}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="pt-3 border-t border-slate-200">
                                                <div className="text-xs font-bold text-slate-400 mb-1">建议措施</div>
                                                <div className="text-xs text-slate-700 font-medium">
                                                    {diag.actions.join('、')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                    <CheckCircle className="w-12 h-12 mb-2 text-green-500" />
                                    <div>所有组串运行正常</div>
                                </div>
                            )}
                        </div>

                        {/* Loss Estimation */}
                        <div className="bg-red-50 rounded-[24px] border border-red-100 p-6 text-red-900">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5" />
                                损失评估
                            </h3>
                            <div className="flex justify-between items-end">
                                <div>
                                    <div className="text-sm opacity-80 mb-1">日发电损失</div>
                                    <div className="text-3xl font-black">{result.lossEstimate.dailyLossKwh.toFixed(1)} <span className="text-lg">kWh</span></div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm opacity-80 mb-1">预估月度营收损失</div>
                                    <div className="text-xl font-bold">¥{result.lossEstimate.monthlyLossRevenue.toFixed(0)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
