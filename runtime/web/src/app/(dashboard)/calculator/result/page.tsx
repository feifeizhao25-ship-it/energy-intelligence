'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Download,
    Share2,
    TrendingUp,
    Calendar,
    DollarSign,
    Zap,
    Leaf,
    FileText,
    BarChart3,
    ChevronDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import InvestmentReport from '@/components/calculator/InvestmentReport';
import AIProjectAnalysis from '@/components/calculator/AIProjectAnalysis';

const PDFDownloadLink = dynamic(
    () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
    { ssr: false }
);

export default function ResultPageWrapper() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader /></div>}>
            <CalculatorResultPage />
        </Suspense>
    );
}

function Loader() {
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-slate-400 text-sm animate-pulse">正在解析计算数据...</span>
        </div>
    );
}

function CalculatorResultPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const type = searchParams.get('type');
    const rawData = searchParams.get('data');

    if (!rawData) return <div className="p-20 text-center text-slate-400">未找到计算结果数据</div>;

    const data = JSON.parse(decodeURIComponent(rawData));

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-20">
            {/* Result Header */}
            <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-white flex items-center gap-2">
                                测算报告: {data.metadata?.projectName || (type === 'solar' ? '光伏' : type === 'wind' ? '风电' : '储能') + '项目'}
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold border border-blue-500/20 tracking-widest">
                                    PRO 分析
                                </span>
                            </h1>
                            <p className="text-xs text-slate-500">报告编号: BR-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700 transition-all flex items-center gap-2">
                            <Share2 className="w-3.5 h-3.5" /> 分享
                        </button>

                        <PDFDownloadButton data={data} type={type || 'solar'} />
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-6 mt-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Dashboard */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard
                                label="项目 IRR"
                                value={`${data.financial.irr.toFixed(2)}%`}
                                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                                trend="+1.2%"
                                color="border-emerald-500/20"
                            />
                            <MetricCard
                                label="静态回收期"
                                value={`${data.financial.paybackYears.toFixed(1)}年`}
                                icon={<Calendar className="w-5 h-5 text-blue-400" />}
                                color="border-blue-500/20"
                            />
                            <MetricCard
                                label="LCOE 度电成本"
                                value={`¥${data.financial.lcoe.toFixed(3)}`}
                                icon={<DollarSign className="w-5 h-5 text-orange-400" />}
                                color="border-orange-500/20"
                            />
                            <MetricCard
                                label="年发电量"
                                value={`${(data.energy?.year1 / 10000).toFixed(1)}万`}
                                unit="kWh"
                                icon={<Zap className="w-5 h-5 text-purple-400" />}
                                color="border-purple-500/20"
                            />
                        </div>

                        {/* Monthly Generation Analysis */}
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-blue-400" />
                                    月度发电分布预测
                                </h3>
                                <div className="flex gap-2">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" /> 发电量 (kWh)
                                    </div>
                                </div>
                            </div>

                            <div className="h-[240px] flex items-end justify-between gap-1 mt-4">
                                {data.energy.monthly.map((val: number, i: number) => {
                                    const max = Math.max(...data.energy.monthly);
                                    const height = (val / max) * 100;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                            <div className="w-full relative">
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${height}%` }}
                                                    className="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm group-hover:from-blue-500 group-hover:to-cyan-400 transition-colors relative"
                                                >
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 z-10">
                                                        {val.toLocaleString()}
                                                    </div>
                                                </motion.div>
                                            </div>
                                            <span className="text-[10px] text-slate-600 font-bold">{i + 1}月</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Financial Analysis Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h3 className="text-lg font-bold text-white mb-6">成本构成分析</h3>
                                <div className="space-y-4">
                                    <CostRow label="工程建设费用" value={(data.financial.investment * 0.85).toLocaleString()} percentage={85} />
                                    <CostRow label="并网及相关费用" value={(data.financial.investment * 0.1).toLocaleString()} percentage={10} />
                                    <CostRow label="前期开发及不可预见" value={(data.financial.investment * 0.05).toLocaleString()} percentage={5} />
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                                <h3 className="text-lg font-bold text-white mb-6">环境效益分析</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                        <Leaf className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                                        <div className="text-emerald-500 font-bold text-lg">{(data.energy.year1 * 0.000785).toFixed(1)}t</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">年减排二氧化碳</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                        <div className="text-2xl mb-1">🌳</div>
                                        <div className="text-emerald-500 font-bold text-lg">{Math.round(data.energy.year1 * 0.000785 * 25 / 0.022)}</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">25年等效植树</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8">
                            <h3 className="text-lg font-bold text-white mb-4">核心参数回顾</h3>
                            <div className="space-y-4">
                                <Parameter label="装机规模" value={`${data.metadata?.capacity || (data.energy?.year1 / (data.energy?.equivalentHours || data.energy?.specificYield || 1)).toFixed(1)} kWp`} />
                                <Parameter label="省份" value={data.metadata?.province || '未知'} />
                                <Parameter label="利用小时数" value={`${Math.round(data.energy?.equivalentHours || data.energy?.specificYield || 0)} h`} />
                                <Parameter label="25年总发电量" value={`${(data.energy?.lifetime / 10000).toFixed(0)}万 kWh`} />
                                <Parameter label="折现率" value="8.0%" />
                            </div>
                            <AIProjectAnalysis type={type || 'solar'} data={data} />
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-8 relative overflow-hidden group transition-all hover:scale-[1.02]">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <TrendingUp className="w-24 h-24" />
                            </div>
                            <h3 className="text-white font-bold mb-2">多点对比分析</h3>
                            <p className="text-white/70 text-xs mb-6 font-medium leading-relaxed">
                                想知道该项目如果建在其他省份或更换为风电会有什么差异吗？
                            </p>
                            <button className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm shadow-xl transition-all hover:bg-white/90">
                                开启多点深度对比
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function MetricCard({ label, value, unit, icon, trend, color }: any) {
    return (
        <div className={`p-6 rounded-3xl bg-slate-900 border ${color} relative overflow-hidden`}>
            <div className="flex flex-col gap-1 relative z-10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
                    {unit && <span className="text-xs text-slate-500">{unit}</span>}
                </div>
                {trend && (
                    <div className="text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> {trend}
                    </div>
                )}
            </div>
            <div className="absolute -right-2 -top-2 p-4 opacity-20">
                {icon}
            </div>
        </div>
    );
}

function CostRow({ label, value, percentage }: any) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
                <span className="text-slate-400">{label}</span>
                <span className="text-white font-mono">¥{value}</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full bg-blue-500`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

function Parameter({ label, value }: any) {
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-300 font-medium">{value}</span>
        </div>
    );
}

function PDFDownloadButton({ data, type }: { data: any, type: string }) {
    const [isClient, setIsClient] = React.useState(false);
    const [shouldRender, setShouldRender] = React.useState(false);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return null;

    if (!shouldRender) {
        return (
            <button
                onClick={() => setShouldRender(true)}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40"
            >
                <Download className="w-3.5 h-3.5" />
                导出详细报表 (PDF)
            </button>
        );
    }

    return (
        <PDFDownloadLink
            document={<InvestmentReport data={data} type={type} />}
            fileName={`investment_report_${type}_${new Date().getTime()}.pdf`}
        >
            {({ loading, error }) => (
                <button
                    disabled={loading}
                    className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40 disabled:opacity-50"
                >
                    <Download className="w-3.5 h-3.5" />
                    {loading ? '正在准备...' : error ? '生成失败，请重试' : '点击下载'}
                </button>
            )}
        </PDFDownloadLink>
    );
}
