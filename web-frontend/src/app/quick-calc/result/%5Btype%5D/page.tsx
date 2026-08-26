'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    Share2,
    Download,
    Zap,
    Wind,
    Battery,
    Sparkles,
    Lock,
    Save,
    TrendingUp,
    ArrowRight,
    Settings2,
    Sliders,
    MessageCircle,
    BarChart3,
    FileText
} from 'lucide-react';
import ProfessionalConfigPanel from '@/components/quick-calc/ProfessionalConfigPanel';
import ResultFlowChart from '@/components/quick-calc/ResultFlowChart';
import EcoContribution from '@/components/quick-calc/EcoContribution';
import ShareCard from '@/components/quick-calc/ShareCard';
import { cn } from '@/lib/utils';

interface ResultDetail {
    label: string;
    value: string;
    highlight?: boolean;
}

export default function QuickCalcResult() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const params = useParams();
    const energyType = (params.type as string) || searchParams.get('energyType') || 'solar';

    const [isProfessionalMode, setIsProfessionalMode] = useState(false);

    const type = searchParams.get('type') || '';
    const area = Number(searchParams.get('area') || 100);
    const capacity = Number(searchParams.get('capacity') || 5);
    const turbines = Number(searchParams.get('turbines') || 5);

    // Calculation Logic with enhanced data
    const resultData = useMemo(() => {
        if (energyType === 'solar') {
            const kw = Math.round(area * 0.15);
            const annualGen = kw * 1250;
            const selfUseRate = 0.7; // 自用比例
            const selfUsePrice = 0.85; // 自用电价
            const gridPrice = 0.41; // 上网电价
            const selfUseIncome = annualGen * selfUseRate * selfUsePrice;
            const gridIncome = annualGen * (1 - selfUseRate) * gridPrice;
            const annualIncome = selfUseIncome + gridIncome;
            const investment = kw * 3500;
            const investmentWan = investment / 10000;
            const paybackYears = investment / annualIncome;
            const total25Year = annualIncome * 22.5 / 10000; // 考虑衰减
            const netProfit = total25Year - investmentWan;
            const irr = ((total25Year / investmentWan) ** (1 / 25) - 1) * 100 + 15; // 简化IRR计算

            return {
                mainValue: total25Year.toFixed(1),
                mainLabel: '25年预计总收益',
                location: searchParams.get('location') || '河北保定',
                capacity: kw,
                investment: investmentWan,
                paybackYears: Math.round(paybackYears * 10) / 10,
                netProfit: netProfit,
                irr: Math.round(irr * 10) / 10,
                annualGeneration: annualGen,
                annualIncome: Math.round(annualIncome),
                monthlyIncome: Math.round(annualIncome / 12),
                details: [
                    { label: '月均被动收入', value: `¥${Math.round(annualIncome / 12)}`, highlight: true },
                    { label: '投资回报率 IRR', value: `${Math.round(irr * 10) / 10}%`, highlight: false },
                    { label: '年发电量', value: `${annualGen.toLocaleString()} 度`, highlight: false }
                ] as ResultDetail[],
                comparison: '是银行理财的 6 倍',
                selfUseIncome: Math.round(selfUseIncome),
                gridIncome: Math.round(gridIncome),
            };
        } else if (energyType === 'wind') {
            const totalMW = turbines * capacity;
            const annualGen = totalMW * 2200 * 1000;
            const totalProjectIncome = (annualGen * 0.4 * 20 / 100000000);
            const villageShare = 0.15;
            const villageIncome = totalProjectIncome * villageShare * 100; // 万/年

            return {
                mainValue: villageIncome.toFixed(0),
                mainLabel: '预计年度集体收益（万）',
                location: searchParams.get('location') || '河北保定',
                capacity: totalMW * 1000,
                investment: totalMW * 8000, // 万元
                paybackYears: 6.5,
                netProfit: totalProjectIncome * 100 * 0.7, // 万
                irr: 15.2,
                annualGeneration: annualGen,
                annualIncome: villageIncome * 10000,
                monthlyIncome: Math.round(villageIncome * 10000 / 12),
                details: [
                    { label: '装机容量', value: `${totalMW} MW`, highlight: false },
                    { label: '村民人均增收', value: '¥2,800/年', highlight: true },
                    { label: '投资回报率', value: '15.2%', highlight: false }
                ] as ResultDetail[],
                comparison: '20年稳定分红',
                villageIncome: villageIncome,
                totalProjectIncome: totalProjectIncome,
            };
        } else {
            // Storage
            const capKwh = Number(capacity) || 500;
            const peakValleySpread = 0.82; // 峰谷价差
            const cycles = 330; // 年循环次数
            const annualSavings = capKwh * peakValleySpread * cycles;
            const investment = capKwh * 1500;
            const investmentWan = investment / 10000;
            const paybackYears = investment / annualSavings;
            const total15Year = annualSavings * 14 / 10000; // 15年，考虑衰减

            return {
                mainValue: (annualSavings / 10000).toFixed(1),
                mainLabel: '预计年节省电费（万）',
                location: searchParams.get('location') || '河北保定',
                capacity: capKwh,
                investment: investmentWan,
                paybackYears: Math.round(paybackYears * 10) / 10,
                netProfit: total15Year - investmentWan,
                irr: 23.5,
                annualGeneration: capKwh * cycles, // 年吞吐电量
                annualIncome: Math.round(annualSavings),
                monthlyIncome: Math.round(annualSavings / 12),
                details: [
                    { label: '峰谷套利收益', value: '72.4%', highlight: true },
                    { label: '需量管理收益', value: '27.6%', highlight: false },
                    { label: '系统寿命', value: '15 年', highlight: false }
                ] as ResultDetail[],
                comparison: '立刻省钱，年年见效',
            };
        }
    }, [energyType, area, capacity, turbines, searchParams]);

    const themeConfig = {
        solar: {
            gradient: 'from-solar-400 to-solar-600',
            icon: Zap,
            iconBg: 'bg-solar-500',
            text: 'text-solar-600',
        },
        wind: {
            gradient: 'from-wind-400 to-wind-600',
            icon: Wind,
            iconBg: 'bg-wind-500',
            text: 'text-wind-600',
        },
        storage: {
            gradient: 'from-storage-400 to-storage-600',
            icon: Battery,
            iconBg: 'bg-storage-500',
            text: 'text-storage-600',
        },
    }[energyType as 'solar' | 'wind' | 'storage'];

    const Icon = themeConfig.icon;

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg", themeConfig.iconBg)}>
                        <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-black text-slate-900 tracking-tight">测算结果</span>
                </div>
                <div className="flex gap-2">
                    <ShareCard
                        energyType={energyType as 'solar' | 'wind' | 'storage'}
                        location={resultData.location}
                        capacity={resultData.capacity}
                        totalRevenue={Number(resultData.mainValue)}
                        paybackYears={resultData.paybackYears}
                        irr={resultData.irr}
                        annualGeneration={resultData.annualGeneration}
                    />
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
                {/* 🎉 Success Banner */}
                <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-bold mb-4">
                        <Sparkles className="w-4 h-4" />
                        恭喜！您的{energyType === 'solar' ? '屋顶' : energyType === 'wind' ? '区域' : '工厂'}很适合{energyType === 'solar' ? '装光伏' : energyType === 'wind' ? '发展风电' : '装储能'}
                    </div>
                </div>

                {/* 💰 Big Number Hero Card */}
                <div className={cn(
                    "relative overflow-hidden p-10 md:p-16 rounded-[48px] text-white shadow-2xl",
                    "bg-gradient-to-br animate-in fade-in slide-in-from-bottom-8 duration-700",
                    themeConfig.gradient
                )}>
                    <div className="relative z-10 text-center space-y-4">
                        <div className="text-white/80 text-sm font-medium">
                            📍 {resultData.location} · {resultData.capacity}kW · ☀️ 资源优秀
                        </div>
                        <h1 className="big-number-xl">
                            ¥{resultData.mainValue}<span className="text-4xl">万</span>
                        </h1>
                        <p className="text-xl font-bold opacity-90">{resultData.mainLabel}</p>

                        {/* Comparison Badge */}
                        <div className="inline-block bg-white/20 backdrop-blur-sm px-6 py-3 rounded-2xl mt-4">
                            <span className="text-lg font-bold">🔥 {resultData.comparison}</span>
                        </div>
                    </div>

                    {/* Background Icon */}
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Icon className="w-64 h-64" />
                    </div>
                </div>

                {/* 📊 Investment Flow Chart */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                    <ResultFlowChart
                        investment={resultData.investment}
                        paybackYears={resultData.paybackYears}
                        netProfit={resultData.netProfit}
                        totalRevenue={Number(resultData.mainValue)}
                        projectYears={energyType === 'storage' ? 15 : 25}
                    />
                </div>

                {/* 📈 Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    {resultData.details.map((d, i) => (
                        <div
                            key={i}
                            className={cn(
                                "bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all group",
                                d.highlight && "ring-2 ring-primary-200"
                            )}
                        >
                            <span className="text-slate-400 font-bold text-sm block mb-2">{d.label}</span>
                            <span className={cn(
                                "text-3xl font-black transition-colors",
                                d.highlight ? "text-primary-600" : "text-slate-900 group-hover:text-primary-600"
                            )}>
                                {d.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 🌱 Eco Contribution */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                    <EcoContribution
                        annualGeneration={resultData.annualGeneration}
                        energyType={energyType as 'solar' | 'wind' | 'storage'}
                        projectYears={energyType === 'storage' ? 15 : 25}
                    />
                </div>

                {/* ⚙️ Professional Mode Toggle */}
                <div className="flex justify-center">
                    <button
                        onClick={() => setIsProfessionalMode(!isProfessionalMode)}
                        className={cn(
                            "group flex items-center gap-3 px-8 py-4 rounded-3xl font-bold text-xs uppercase tracking-widest transition-all",
                            isProfessionalMode
                                ? "bg-slate-900 text-white shadow-2xl scale-105"
                                : "bg-white text-slate-400 border border-slate-200 hover:border-primary-300 hover:text-primary-600 shadow-sm"
                        )}
                    >
                        {isProfessionalMode ? (
                            <><Settings2 className="w-4 h-4 text-primary-400 animate-spin-slow" /> 退出专业模式</>
                        ) : (
                            <><Sliders className="w-4 h-4 group-hover:text-primary-500 transition-colors" /> 开启专业精细化调参</>
                        )}
                    </button>
                </div>

                {isProfessionalMode && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <ProfessionalConfigPanel type={energyType} />
                    </div>
                )}

                {/* 🔒 Paywall - Detailed Analysis */}
                <div className="relative group">
                    <div className="bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-lg">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <BarChart3 className="w-6 h-6 text-primary-500" />
                                <h3 className="text-xl font-black text-slate-900">深度财务与气象分析</h3>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full">
                                <Lock className="w-3 h-3" />
                                专业版
                            </div>
                        </div>

                        <div className="relative h-[300px]">
                            {/* Blurred Preview */}
                            <div className="absolute inset-0 p-8 blur-lg opacity-40 select-none pointer-events-none">
                                <div className="flex gap-4 items-end h-48">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                                        <div key={i} className="flex-1 bg-primary-200 rounded-t-lg" style={{ height: `${30 + Math.random() * 70}%` }} />
                                    ))}
                                </div>
                            </div>

                            {/* Unlock CTA */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-10 bg-gradient-to-b from-transparent via-white/80 to-white">
                                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 max-w-sm space-y-4">
                                    <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto shadow-primary">
                                        <TrendingUp className="text-white w-8 h-8" />
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900">查看 25 年现金流详情</h4>
                                    <p className="text-slate-500 text-sm">
                                        解锁月度发电细节、逐年现金流表及敏感性分析报告
                                    </p>
                                    <button
                                        onClick={() => router.push('/login')}
                                        className="w-full btn-primary flex items-center justify-center gap-2"
                                    >
                                        立即登录解锁 <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 💬 Hot Questions (AI Hook) */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <MessageCircle className="w-5 h-5 text-primary-500" />
                        <span className="font-bold text-slate-900">💬 有问题？问AI助手</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            '这个收益靠谱吗？',
                            '贷款划算还是全款？',
                            '找谁安装比较好？',
                            '现在还有补贴吗？'
                        ].map((q, i) => (
                            <button
                                key={i}
                                onClick={() => router.push(`/assistant?q=${encodeURIComponent(q)}`)}
                                className="px-4 py-2 bg-slate-50 rounded-full text-sm font-medium text-slate-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Secondary CTAs */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => router.push('/assistant')}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all text-left group"
                    >
                        <Sparkles className="w-8 h-8 text-primary-500 mb-3 group-hover:scale-110 transition-transform" />
                        <h5 className="font-bold text-slate-900 text-lg">AI 专家诊断</h5>
                        <p className="text-slate-400 text-xs mt-1">让 AI 帮您评估项目可行性</p>
                    </button>
                    <button
                        onClick={() => router.push('/quick-calc/compare')}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all text-left group"
                    >
                        <FileText className="w-8 h-8 text-wind-500 mb-3 group-hover:rotate-3 transition-transform" />
                        <h5 className="font-bold text-slate-900 text-lg">多能源对比</h5>
                        <p className="text-slate-400 text-xs mt-1">对比不同能源方案收益</p>
                    </button>
                </div>
            </main>

            {/* Fixed Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 w-full p-4 z-50 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pt-8">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <button
                        onClick={() => router.push('/login')}
                        className="flex-[2] bg-slate-900 text-white p-5 rounded-2xl font-bold text-lg hover:bg-primary-600 transition-all shadow-xl flex items-center justify-center gap-2 group"
                    >
                        <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        保存到我的电站
                    </button>
                    <button
                        onClick={() => router.push(`/quick-calc/${energyType}`)}
                        className="flex-1 bg-white border-2 border-slate-200 p-5 rounded-2xl font-bold text-lg text-slate-700 hover:border-primary-300 transition-all shadow-lg"
                    >
                        重新测算
                    </button>
                </div>
            </div>
        </div>
    );
}
