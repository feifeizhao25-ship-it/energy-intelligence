'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Download,
    TrendingUp,
    Calendar,
    DollarSign,
    Zap,
    Leaf,
    FileText,
    BarChart3,
    ChevronDown
} from 'lucide-react';
import dynamic from 'next/dynamic';
import InvestmentReport from '@/components/calculator/InvestmentReport';
import MonthlyGenerationBarChart from '@/components/charts/MonthlyGenerationBarChart';
import CostBreakdownEditor from '@/components/calculator/CostBreakdownEditor';
import AIProjectAnalysis from '@/components/calculator/AIProjectAnalysis';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { co2AvoidedTonnes, EMISSION_FACTOR_NOTE } from '@/lib/standards/emission-factor';
import { priceAsOfText } from '@/lib/pricing/tariffs';

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

    let data: any;
    try {
        data = JSON.parse(rawData);
    } catch {
        return <div className="p-20 text-center text-slate-400">计算结果格式无效，请返回重新测算</div>;
    }

    if (!data?.financial || !data?.energy || !Array.isArray(data.energy.monthly)) {
        return <div className="p-20 text-center text-slate-400">计算结果不完整，请返回重新测算</div>;
    }

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 pb-20">
            {/* Result Header：手机上标题与按钮分两行，标题正常换行，按钮可折行，不再撑出屏幕 */}
            <div className="bg-slate-900/50 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <button
                            onClick={() => router.back()}
                            aria-label="返回"
                            className="shrink-0 p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                                测算报告：{data.metadata?.projectName || (type === 'solar' ? '光伏' : type === 'wind' ? '风电' : '储能') + '项目'}
                                <span className="ml-2 inline-block whitespace-nowrap align-middle px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                                    初步估算
                                </span>
                            </h1>
                            <p className="mt-0.5 text-xs text-slate-500 break-all">
                                计算记录编号：{data.metadata?.calculationId || data.metadata?.snapshotId || '尚未生成'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                        <WordDownloadButton data={data} type={type || 'solar'} />
                        <PDFDownloadButton data={data} type={type || 'solar'} />
                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 sm:mt-10">
                <p
                    data-testid="price-as-of"
                    className={`mb-6 rounded-xl border px-4 py-3 text-xs leading-6 ${(data.metadata?.pricing ?? data.pricing)?.stale ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-slate-900 text-slate-400'}`}
                >
                    {/* 光伏快速测算把电价信息放在 metadata.pricing，风电接口直接返回 pricing */}
                    {priceAsOfText(data.metadata?.pricing ?? data.pricing)}
                    {(data.metadata?.pricing ?? data.pricing)?.feedInBasis && <span className="mt-1 block">{(data.metadata?.pricing ?? data.pricing).feedInBasis}</span>}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

                    {/* Main Dashboard */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Key Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard
                                label="项目 IRR"
                                value={`${data.financial.irr.toFixed(2)}%`}
                                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
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
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8">
                            <div className="mb-4 sm:mb-8">
                                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-blue-400" />
                                    月度发电量（估算）
                                </h3>
                            </div>

                            <div className="mt-4" data-testid="monthly-generation">
                                <MonthlyGenerationBarChart data={data.energy} theme="dark" barAreaPx={200} />
                            </div>
                        </div>

                        {/* Financial Analysis Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8">
                                <h3 className="text-lg font-bold text-white mb-6">成本构成（按你的报价填写）</h3>
                                <CostBreakdownEditor investment={data.financial.investment} />
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8">
                                <h3 className="text-lg font-bold text-white mb-6">环境效益分析</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                        <Leaf className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                                        <div className="text-emerald-500 font-bold text-lg">{co2AvoidedTonnes(data.energy.year1).toFixed(1)}t</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">年减排二氧化碳</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                        <div className="text-2xl mb-1">🌳</div>
                                        <div className="text-emerald-500 font-bold text-lg">{Math.round(co2AvoidedTonnes(data.energy.lifetime || data.energy.year1 * 25) / 0.022)}</div>
                                        <div className="text-slate-500 text-[10px] uppercase font-bold">25年等效植树</div>
                                    </div>
                                </div>
                                <p className="mt-4 text-[11px] text-slate-500">{EMISSION_FACTOR_NOTE}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-8">
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

                        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 sm:p-8 relative overflow-hidden group transition-all hover:scale-[1.02]">
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
        <div className={`p-4 sm:p-6 rounded-3xl bg-slate-900 border ${color} relative overflow-hidden min-w-0`}>
            <div className="flex flex-col gap-1 relative z-10">
                <span className="text-[11px] font-bold text-slate-400 leading-4">{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-bold text-white tracking-tight break-all">{value}</span>
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
    const [reserving, setReserving] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return null;

    if (!shouldRender) {
        return (
            <div className="flex flex-col items-start gap-1 sm:items-end">
                <button
                    disabled={reserving}
                    onClick={async () => {
                        setReserving(true);
                        setErrorMessage('');
                        try {
                            const response = await fetch('/api/exports/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'pdf' }) });
                            const payload = await response.json();
                            if (!response.ok) throw new Error(payload.message || '导出额度核验失败');
                            setShouldRender(true);
                        } catch (error) {
                            setErrorMessage(safeErrorMessage(error, '导出额度核验失败'));
                        } finally {
                            setReserving(false);
                        }
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40 disabled:opacity-50"
                >
                    <Download className="w-3.5 h-3.5" />
                    {reserving ? '正在核验额度…' : '导出 PDF'}
                </button>
                {errorMessage && <span className="max-w-64 text-[11px] text-red-400 sm:text-right">{errorMessage}</span>}
            </div>
        );
    }

    return (
        <PDFDownloadLink
            document={<InvestmentReport data={data} type={type} />}
            fileName={`测算报告_${type}_${new Date().getTime()}.pdf`}
        >
            {({ loading, error }) => (
                <button
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/40 disabled:opacity-50"
                >
                    <Download className="w-3.5 h-3.5" />
                    {loading ? '正在准备...' : error ? '生成失败，请重试' : '点击下载'}
                </button>
            )}
        </PDFDownloadLink>
    );
}

/** Word（.docx）导出：先向服务端核验套餐是否含 Word 并扣一次导出额度，再在浏览器生成文件。内容与 PDF 报告同一来源。 */
function WordDownloadButton({ data, type }: { data: any, type: string }) {
    const [busy, setBusy] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    return (
        <div className="flex flex-col items-start gap-1 sm:items-end">
            <button
                disabled={busy}
                onClick={async () => {
                    setBusy(true);
                    setErrorMessage('');
                    try {
                        const response = await fetch('/api/exports/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'docx' }) });
                        const payload = await response.json().catch(() => ({}));
                        if (!response.ok) throw new Error(payload.message || '导出额度核验失败');
                        const { calculationDocxBlob } = await import('@/lib/reports/calculation-docx');
                        const blob = await calculationDocxBlob(data, type);
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `测算报告_${type}_${Date.now()}.docx`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (error) {
                        setErrorMessage(safeErrorMessage(error, 'Word 报告生成失败，请稍后重试'));
                    } finally {
                        setBusy(false);
                    }
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
                <FileText className="w-3.5 h-3.5" />
                {busy ? '正在生成…' : '导出 Word'}
            </button>
            {errorMessage && <span className="max-w-64 text-[11px] text-red-400 sm:text-right">{errorMessage}</span>}
        </div>
    );
}
