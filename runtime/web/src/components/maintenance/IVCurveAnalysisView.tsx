'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    Search,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Zap,
    Maximize2,
    Download,
    FileText
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';

// 仅用于空状态坐标系，不表示实测曲线或诊断结果。
const generateCurveData = (type: 'normal' | 'pid' | 'shade') => {
    const data = [];
    const voc = 45;
    const isc = 10;

    for (let v = 0; v <= voc; v += 0.5) {
        let i = 0;
        if (type === 'normal') {
            // Standard single diode model approximation
            i = isc * (1 - Math.exp((v - voc) / 2));
            // Simplified heavily for visuals: Ideal curve is roughly flat then sharp drop
            if (v < 35) i = isc;
            else i = isc * Math.pow((voc - v) / 10, 0.3);
        } else if (type === 'pid') {
            // PID causes slope in the flat part (low shunt resistance effect)
            if (v < 35) i = isc - (v * 0.1);
            else i = (isc - 3.5) * Math.pow((voc - v) / 10, 0.5);
        }

        // Clamp and ensure non-NaN
        i = Math.max(0, Math.min(isc, i || 0));

        // Power calculation P = V * I
        const p = v * i;

        data.push({ v: v, i: Number(i.toFixed(2)), p: Number(p.toFixed(2)) });
    }
    return data;
};

export default function IVCurveAnalysisView() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [analyzing, setAnalyzing] = useState(false);

    // Initial load
    useEffect(() => {
        // Pre-load a normal curve for visualization
        setResult({
            health: 0,
            diagnosis: '等待扫描',
            issues: [],
            suggestion: '',
            curveData: generateCurveData('normal')
        });
    }, []);

    const handleScan = async () => {
        return;
    };

    return (
        <div className="space-y-6">
            {/* Header Control */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <Activity className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">IV 曲线智能诊断</h2>
                            <p className="text-sm text-slate-500">毫秒级捕捉组件输出特性，识别隐蔽故障</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option>所有汇流箱</option>
                            <option>汇流箱 #A01</option>
                            <option>汇流箱 #A02</option>
                        </select>
                        <button
                            disabled
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            等待 IV 实测数据
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Area */}
                <div className="lg:col-span-2 bg-white rounded-[24px] border border-slate-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            IV 特性曲线
                        </h3>
                        {result && (
                            <div className="flex gap-4 text-xs font-bold">
                                <span className="flex items-center gap-1.5 text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    电流 (A)
                                </span>
                                <span className="flex items-center gap-1.5 text-slate-500">
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    功率 (W)
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="h-[400px] w-full bg-slate-50/50 rounded-2xl p-4 relative">
                        {analyzing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-2xl">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                    <span className="text-sm font-bold text-indigo-600">正在分析波形...</span>
                                </div>
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result?.curveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="v"
                                    label={{ value: '电压 (V)', position: 'insideBottomRight', offset: -5, fontSize: 12, fill: '#94A3B8' }}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="left"
                                    label={{ value: '电流 (A)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94A3B8' }}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    label={{ value: '功率 (W)', angle: -90, position: 'insideRight', fontSize: 12, fill: '#94A3B8' }}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    cursor={{ stroke: '#94A3B8', strokeDasharray: '4 4' }}
                                />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="i"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="p"
                                    stroke="#fbbf24"
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Analysis Result Panel */}
                <div className="space-y-6">
                    {/* Health Score */}
                    <div className="bg-white rounded-[24px] border border-slate-100 p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">健康评分</h3>
                        <div className="flex items-baseline gap-2 mb-4 relative">
                            <span className={`text-6xl font-black ${result?.health >= 90 ? 'text-green-500' : result?.health >= 70 ? 'text-amber-500' : 'text-slate-200'}`}>
                                {result?.health || '--'}
                            </span>
                            <span className="text-lg font-bold text-slate-400">/ 100</span>
                        </div>

                        {result?.health > 0 && (
                            <div className={`p-3 rounded-xl border ${result.health >= 90 ? 'bg-green-50 border-green-100 text-green-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                <div className="flex items-start gap-2">
                                    {result.health >= 90 ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                                    <div>
                                        <div className="font-bold text-sm mb-1">{result.diagnosis}</div>
                                        <div className="text-xs opacity-80">{result.suggestion}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Key Parameters */}
                    <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                        <h3 className="font-bold text-slate-900 mb-4">关键参数实测</h3>
                        <div className="space-y-4">
                            {[
                                { label: 'Voc (开路电压)', value: '45.2 V', status: 'normal' },
                                { label: 'Isc (短路电流)', value: '10.15 A', status: 'normal' },
                                { label: 'Vmpp (最大功率点电压)', value: '36.8 V', status: 'warning' },
                                { label: 'FF (填充因子)', value: result?.health >= 90 ? '78.5%' : '65.2%', status: result?.health >= 90 ? 'normal' : 'error' },
                            ].map((param, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                    <span className="text-xs font-bold text-slate-500">{param.label}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-900">{param.value}</span>
                                        <div className={`w-2 h-2 rounded-full ${param.status === 'normal' ? 'bg-green-500' : param.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button className="w-full py-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />
                        导出原始数据 (.CSV)
                    </button>
                </div>
            </div>
        </div>
    );
}
