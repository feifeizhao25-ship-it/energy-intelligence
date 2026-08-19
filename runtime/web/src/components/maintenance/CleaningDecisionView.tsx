'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Droplets,
    Sun,
    CloudRain,
    DollarSign,
    Calendar,
    ArrowRight,
    Loader2,
    CheckCircle2,
    XCircle,
    Info,
    Wind
} from 'lucide-react';
import { CleaningDecisionInput, CleaningDecision } from '@/lib/maintenance/types';
import { getCleaningDecisionAction } from '@/app/actions/maintenance';

interface CleaningDecisionViewProps {
    stationId: string;
    stationName: string;
    capacity: number;
    location: string;
}

export default function CleaningDecisionView({ stationId, stationName, capacity, location }: CleaningDecisionViewProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<CleaningDecision | null>(null);
    const [lastCleaning, setLastCleaning] = useState<string>(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            // Mock lat/lng based on typical locations if not provided strictly
            // In production, fetch from station details
            const data = await getCleaningDecisionAction({
                lat: 39.9, // Default Beijing
                lng: 116.4,
                capacity,
                lastCleaningDate: lastCleaning,
                cleaningCostPerKw: 3 // Mock cost
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
            {/* Input Section */}
            <div className="bg-white rounded-[24px] border border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">智能清洗决策</h2>
                        <p className="text-sm text-slate-500">基于气象数据与积灰模型的成本效益分析</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">上次清洗日期</label>
                        <input
                            type="date"
                            value={lastCleaning}
                            onChange={(e) => setLastCleaning(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">清洗成本 (估算)</label>
                        <div className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 font-medium text-slate-500">
                            ¥{(capacity * 3).toLocaleString()} <span className="text-xs">(@ 3元/kW)</span>
                        </div>
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <SparklesIcon />}
                        {loading ? '正在分析...' : '生成决策建议'}
                    </button>
                </div>
            </div>

            {/* Results Section */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                    {/* Main Recommendation Card */}
                    <div className={`md:col-span-1 p-6 rounded-[24px] border-2 flex flex-col items-center justify-center text-center ${result.recommendation.shouldClean ? 'bg-green-50/50 border-green-200' : 'bg-slate-50/50 border-slate-200'}`}>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${result.recommendation.shouldClean ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                            {result.recommendation.shouldClean ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">
                            {result.recommendation.shouldClean ? '建议立即清洗' : '暂不建议清洗'}
                        </h3>
                        <p className="text-slate-600 font-medium mb-6">
                            {result.recommendation.reason}
                        </p>

                        {result.recommendation.shouldClean && (
                            <div className="w-full bg-white rounded-xl p-4 border border-green-100 shadow-sm text-left">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">最佳窗口期</div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900 flex items-center gap-1">
                                        <Calendar className="w-4 h-4 text-green-500" />
                                        {result.recommendation.bestWindow.date}
                                    </span>
                                    <span className="font-mono text-slate-500">{result.recommendation.bestWindow.time}</span>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    <Sun className="w-3 h-3" />
                                    {result.recommendation.bestWindow.weather} · {result.recommendation.bestWindow.temp}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Soiling Analysis */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Wind className="w-5 h-5 text-slate-400" />
                                积灰程度分析
                            </h3>
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <StatItem label="距上次清洗" value={`${result.soilingAssessment.lastCleaningDays}天`} />
                                <StatItem label="平均 PM2.5" value={result.soilingAssessment.avgPm25.toFixed(0)} unit="μg/m³" />
                                <StatItem label="预估发电损失" value={result.soilingAssessment.estimatedLoss.toFixed(1)} unit="%" color="text-red-500" />
                            </div>

                            <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-1000"
                                    style={{ width: `${Math.min(100, result.soilingAssessment.estimatedLoss * 5)}%` }} // Scale factor
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
                                <span>清洁 (0%)</span>
                                <span>轻度污染 (5%)</span>
                                <span>重度积灰 (&gt;20%)</span>
                            </div>
                        </div>

                        {/* Economic Analysis */}
                        <div className="bg-white rounded-[24px] border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-slate-400" />
                                成本效益测算
                            </h3>
                            <div className="flex items-center gap-8">
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-slate-500">投入成本</span>
                                        <span className="text-sm font-bold text-slate-900">¥{result.economicAnalysis.totalCost.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-slate-400 w-full" />
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">包含清洗费用及停机损失</div>
                                </div>

                                <ArrowRight className="w-5 h-5 text-slate-300" />

                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-emerald-600">预计月度增收</span>
                                        <span className="text-sm font-bold text-emerald-600">+¥{result.economicAnalysis.monthlyRevenueGain.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-full" />
                                    </div>
                                    <div className="text-xs text-emerald-500 mt-1">ROI: {((result.economicAnalysis.monthlyRevenueGain / result.economicAnalysis.totalCost) * 100).toFixed(0)}%</div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-start gap-2">
                                    <Info className="w-4 h-4 text-cyan-500 mt-0.5" />
                                    <div className="text-sm text-slate-600">
                                        <span className="font-bold text-slate-900">专家提示：</span>
                                        {result.proTips[0]}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

function StatItem({ label, value, unit, color = "text-slate-900" }: any) {
    return (
        <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-xs text-slate-400 font-bold uppercase mb-1">{label}</div>
            <div className={`text-xl font-black ${color}`}>
                {value} <span className="text-sm text-slate-400 font-bold">{unit}</span>
            </div>
        </div>
    );
}

function SparklesIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
    );
}
