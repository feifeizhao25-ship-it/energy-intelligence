'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    BarChart3,
    Calendar,
    CloudSun,
    TrendingUp,
    AlertTriangle,
    Loader2
} from 'lucide-react';
import { PRAnalysisReport } from '@/lib/maintenance/types';
import { getPRAnalysisAction } from '@/app/actions/maintenance';

interface PRAnalysisViewProps {
    stationId: string;
    capacity: number;
    location: { lat: number, lng: number };
}

export default function PRAnalysisView({ stationId, capacity, location }: PRAnalysisViewProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PRAnalysisReport | null>(null);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1st
        end: new Date().toISOString().split('T')[0]
    });

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const data = await getPRAnalysisAction({
                lat: location.lat,
                lng: location.lng,
                capacity,
                actualGeneration: capacity * 3.5 * 30 * 6, // Mock: ~6 months of gen
                startDate: dateRange.start.replace(/-/g, ''),
                endDate: dateRange.end.replace(/-/g, ''),
                tilt: 25
            });
            setResult(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Input Header */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">能效 PR 深度分析</h2>
                            <p className="text-sm text-slate-500">Performance Ratio 溯源诊断</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl">
                        <div className="flex items-center gap-2 px-3">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none w-32"
                            />
                            <span className="text-slate-300">-</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none w-32"
                            />
                        </div>
                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg shadow-purple-500/30 transition-all disabled:opacity-70 flex items-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? '分析中' : '开始诊断'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Analysis Result */}
            {result && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                    {/* PR Gauge Card */}
                    <div className="bg-white rounded-[24px] border border-slate-100 p-8 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Activity className="w-32 h-32" />
                        </div>
                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">综合能效比 (PR)</div>

                        <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="96" cy="96" r="88" className="text-slate-100" strokeWidth="16" stroke="currentColor" fill="none" />
                                <circle
                                    cx="96" cy="96" r="88"
                                    className={`${result.performance.pr >= 0.8 ? 'text-green-500' : 'text-amber-500'}`}
                                    strokeWidth="16"
                                    strokeDasharray={2 * Math.PI * 88}
                                    strokeDashoffset={2 * Math.PI * 88 * (1 - result.performance.pr)}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="none"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-5xl font-black text-slate-900">{(result.performance.pr * 100).toFixed(1)}%</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">行业基准 {(result.performance.benchmarkPr * 100).toFixed(1)}%</span>
                            </div>
                        </div>

                        <div className="flex gap-2 text-xs font-bold px-3 py-1 bg-slate-50 rounded-full text-slate-500">
                            偏差值: <span className={`${result.performance.deviation > -0.05 ? 'text-green-600' : 'text-red-500'}`}>{(result.performance.deviation * 100).toFixed(1)}%</span>
                        </div>
                    </div>

                    {/* Breakdown & Diagnostics */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <div className="text-xs text-slate-400 font-bold mb-1">理论发电量</div>
                                <div className="text-lg font-black text-slate-900">{(result.performance.theoreticalGen / 1000).toFixed(1)} <span className="text-sm text-slate-400">MWh</span></div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <div className="text-xs text-slate-400 font-bold mb-1">实际发电量</div>
                                <div className="text-lg font-black text-slate-900">{(result.performance.actualGen / 1000).toFixed(1)} <span className="text-sm text-slate-400">MWh</span></div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl">
                                <div className="text-xs text-slate-400 font-bold mb-1">峰值日照时数</div>
                                <div className="text-lg font-black text-slate-900">{result.meteoData.peakSunHours.toFixed(0)} <span className="text-sm text-slate-400">h</span></div>
                            </div>
                        </div>

                        {/* AI Diagnosis List */}
                        <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <CloudSun className="w-5 h-5 text-blue-500" />
                                智能归因分析
                            </h3>
                            {result.diagnostics.length > 0 ? (
                                <div className="space-y-4">
                                    {result.diagnostics.map((diag, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                            <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                                <div className="text-xs font-bold text-slate-400">可能性</div>
                                                <div className="text-lg font-black text-purple-600">{diag.probability * 100}%</div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-bold text-slate-900">{diag.reason}</h4>
                                                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">影响: {diag.impact}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mb-2">{diag.evidence}</p>
                                                <div className="flex gap-2">
                                                    <div className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-500">
                                                        <span className="font-bold">验证:</span> {diag.verification}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">暂无明显异常，系统运行良好</div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
