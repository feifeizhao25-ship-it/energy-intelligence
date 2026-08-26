'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Zap,
    Wind,
    Battery,
    CheckCircle2,
    TrendingUp,
    Download,
    Share2,
    MessageSquare,
    Sparkles,
    ArrowRight
} from 'lucide-react';
import LocationHeader from '@/components/quick-calc/LocationHeader';
import { cn } from '@/lib/utils';

export default function ComparePage() {
    const router = useRouter();

    const comparisonData = [
        {
            id: 'solar',
            title: '光伏发电',
            icon: Zap,
            type: '工商业屋顶',
            investment: '200 万',
            irr: '18.5%',
            payback: '5.3 年',
            annualIncome: '34 万',
            total25: '850 万',
            score: 5,
            color: 'solar'
        },
        {
            id: 'wind',
            title: '风力发电',
            icon: Wind,
            type: '分布式风电',
            investment: '2500 万',
            irr: '15.2%',
            payback: '6.5 年',
            annualIncome: '380 万',
            total20: '3.2 亿',
            score: 3,
            color: 'wind'
        },
        {
            id: 'storage',
            title: '储能系统',
            icon: Battery,
            type: '工商业储能',
            investment: '50 万',
            irr: '23.5%',
            payback: '4.2 年',
            annualIncome: '42 万',
            total15: '590 万',
            score: 4,
            color: 'storage'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 pt-20 pb-12 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        返回首页
                    </button>

                    <div className="flex gap-2">
                        <button className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                            <Share2 className="w-5 h-5" />
                        </button>
                        <button className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="text-center mb-12 space-y-4">
                    <h1 className="text-4xl font-black text-slate-900">综合对比：哪种方案更适合你？</h1>
                    <p className="text-slate-500 text-lg">基于您当前所在区域的资源与政策环境深度对标</p>
                </div>

                <LocationHeader city="保定市" resourceLevel="光储组合最优" type="compare" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {comparisonData.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "bg-white rounded-[40px] border-2 p-8 transition-all duration-300 hover:shadow-2xl relative overflow-hidden",
                                item.color === 'solar' && "border-solar-100 hover:border-solar-500",
                                item.color === 'wind' && "border-wind-100 hover:border-wind-500",
                                item.color === 'storage' && "border-storage-100 hover:border-storage-500"
                            )}
                        >
                            <div className={cn(
                                "w-16 h-16 rounded-2xl flex items-center justify-center mb-6",
                                item.color === 'solar' && "bg-solar-500 text-white shadow-lg shadow-solar-100",
                                item.color === 'wind' && "bg-wind-500 text-white shadow-lg shadow-wind-100",
                                item.color === 'storage' && "bg-storage-500 text-white shadow-lg shadow-storage-100"
                            )}>
                                <item.icon className="w-8 h-8" />
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900">{item.title}</h3>
                                    <p className="text-slate-500 font-medium">{item.type}</p>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-50">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">初始投资</span>
                                        <span className="text-slate-900 font-black">{item.investment}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">预期 IRR</span>
                                        <span className={cn(
                                            "font-black",
                                            item.color === 'solar' && "text-solar-600",
                                            item.color === 'wind' && "text-wind-600",
                                            item.color === 'storage' && "text-storage-600"
                                        )}>{item.irr}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">回本年限</span>
                                        <span className="text-slate-900 font-black">{item.payback}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold">主要收益</span>
                                        <span className="text-slate-900 font-black">{item.annualIncome}/年</span>
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <div className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-widest">综合推荐度</div>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <div
                                                key={star}
                                                className={cn(
                                                    "w-6 h-1.5 rounded-full",
                                                    star <= item.score
                                                        ? (item.color === 'solar' ? "bg-solar-500" : item.color === 'wind' ? "bg-wind-500" : "bg-storage-500")
                                                        : "bg-slate-100"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* AI 推荐板块 */}
                <div className="bg-slate-900 rounded-[48px] p-8 md:p-16 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Sparkles className="w-64 h-64 text-green-400" />
                    </div>

                    <div className="relative z-10 max-w-3xl">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="bg-green-500 p-2 rounded-xl">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-[0.2em] text-green-400">AI 智能推荐方案</span>
                        </div>

                        <h3 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
                            🏆 最佳方案：光伏 + 储能组合
                        </h3>

                        <div className="space-y-6 text-slate-400 text-lg leading-relaxed mb-12">
                            <p>
                                基于河北省保定市优秀的太阳能辐照数据（GHI 1620 kWh/m²）以及较大的峰谷价差（0.82 元/kWh），我们为您推荐<strong>光储一体化</strong>方案。
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-4">
                                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-1" />
                                    <span><strong>资源最大化：</strong>你有闲置顶，光伏发电成本仅为 0.25 元/度。</span>
                                </li>
                                <li className="flex gap-4">
                                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-1" />
                                    <span><strong>收益多样化：</strong>通过储能移峰填谷，不仅能省电费，还能提高光伏自用率。</span>
                                </li>
                                <li className="flex gap-4">
                                    <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-1" />
                                    <span><strong>协同效应：</strong>综合 IRR 预计可提升至 22%，回收期缩短 1.2 年。</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-8 rounded-[32px] mb-12 backdrop-blur-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                                <div>
                                    <div className="text-slate-500 text-xs font-black uppercase mb-2">组合建议</div>
                                    <div className="text-2xl font-black text-white">500kW + 200kWh</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs font-black uppercase mb-2">总投资</div>
                                    <div className="text-2xl font-black text-white">约 200 万</div>
                                </div>
                                <div>
                                    <div className="text-slate-500 text-xs font-black uppercase mb-2">综合 IRR</div>
                                    <div className="text-2xl font-black text-green-400">22% 🔥</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <button className="bg-green-500 text-white px-10 py-5 rounded-3xl font-black text-xl hover:bg-green-400 transition-all flex items-center gap-3 shadow-xl shadow-green-900/40 group">
                                查看光储一体详细方案
                                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => router.push('/ai')}
                                className="bg-slate-800 text-white border border-slate-700 px-10 py-5 rounded-3xl font-black text-xl hover:bg-slate-700 transition-all flex items-center gap-3"
                            >
                                <MessageSquare className="w-6 h-6" />
                                咨询专家
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
