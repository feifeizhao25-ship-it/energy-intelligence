'use client';

import React, { useState } from 'react';
import {
    FolderOpen,
    Plus,
    Search,
    MoreHorizontal,
    Download,
    Share2,
    TrendingUp,
    Zap,
    MapPin,
    ArrowUpRight,
    LayoutGrid,
    List,
    Sparkles,
    Activity,
    Leaf,
    Battery
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function MyProjectsPage() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const stats = [
        { label: '总装机容量', value: '7.0', unit: 'MW', icon: Zap, color: 'text-amber-500' },
        { label: '预计年净收益', value: '¥ 145', unit: '万', icon: TrendingUp, color: 'text-green-500' },
        { label: '累计减碳量', value: '1,240', unit: '吨', icon: Leaf, color: 'text-emerald-500' },
    ];

    const projects = [
        {
            id: 'STA-6821',
            name: '张家口屋顶光储一体化',
            type: 'Solar + Storage',
            location: '河北省张家口市桥东区',
            capacity: '1,200',
            unit: 'kW',
            irr: '14.8%',
            status: 'Monitoring',
            dailyYield: '4,200 kWh',
            color: 'emerald'
        },
        {
            id: 'STA-9022',
            name: '保定高新区厂房风电项目',
            type: 'Wind Energy',
            location: '河北省保定市竞秀区',
            capacity: '800',
            unit: 'kW',
            irr: '12.5%',
            status: 'Calculation',
            dailyYield: 'Pending',
            color: 'blue'
        },
        {
            id: 'STA-1102',
            name: '海南万宁渔光互补资产',
            type: 'Solar Energy',
            location: '海南省万宁市后安镇',
            capacity: '5,000',
            unit: 'kW',
            irr: '16.2%',
            status: 'Draft',
            dailyYield: 'Simulated',
            color: 'green'
        }
    ];

    return (
        <div className="min-h-screen bg-[#FBFDFF] pb-24">
            {/* Master Dashboard Header */}
            <div className="bg-slate-900 pt-32 pb-20 px-6 md:px-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.15),transparent)] pointer-events-none"></div>
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Activity className="w-96 h-96 text-white" />
                </div>

                <div className="max-w-7xl mx-auto space-y-12 relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter">
                                我的 <span className="text-green-500">动力资产</span>
                            </h1>
                            <p className="text-slate-400 font-bold text-lg">My Energy Assets & Stations</p>
                        </div>
                        <div className="flex gap-4">
                            <Link href="/quick-calc/solar" className="bg-green-500 hover:bg-green-400 text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-green-500/20 flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                增加新电站
                            </Link>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {stats.map((s, i) => (
                            <div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-[40px] flex items-center justify-between group hover:bg-white/10 transition-all cursor-default">
                                <div className="space-y-1">
                                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{s.label}</span>
                                    <div className="text-3xl font-black text-white tracking-tighter">
                                        {s.value} <span className="text-sm font-bold opacity-50">{s.unit}</span>
                                    </div>
                                </div>
                                <div className={cn("p-4 rounded-2xl bg-white/5", s.color)}>
                                    <s.icon className="w-6 h-6" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-16 px-6 md:px-12 space-y-12">
                {/* Search & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-8 w-full md:w-auto overflow-x-auto no-scrollbar pb-2 md:pb-0">
                        {['全部资产', '全网运行', '正在测算', '方案草稿'].map((f, i) => (
                            <button key={f} className={cn(
                                "text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 pb-2",
                                i === 0 ? "text-slate-900 border-green-500" : "text-slate-400 border-transparent hover:text-slate-600"
                            )}>
                                {f}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-green-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="搜索资产..."
                                className="w-full md:w-64 bg-slate-100 p-4 pl-12 rounded-2xl border-2 border-transparent focus:border-green-500 focus:bg-white outline-none font-bold text-sm transition-all"
                            />
                        </div>
                        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                            <button onClick={() => setViewMode('grid')} className={cn("p-2.5 rounded-xl transition-all", viewMode === 'grid' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50")}>
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button onClick={() => setViewMode('list')} className={cn("p-2.5 rounded-xl transition-all", viewMode === 'list' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50")}>
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stations Grid */}
                <div className={cn(
                    "grid gap-8",
                    viewMode === 'grid' ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                )}>
                    {projects.map((proj) => (
                        <div key={proj.id} className="bg-white rounded-[56px] border border-slate-100 hover:border-green-100 hover:shadow-2xl hover:shadow-green-500/5 transition-all p-10 group relative flex flex-col md:flex-row gap-8 overflow-hidden">
                            {/* Decorative ID mark */}
                            <div className="absolute top-0 right-0 p-10 select-none">
                                <span className="text-[48px] font-black text-slate-50 opacity-[0.03] tracking-tighter group-hover:opacity-[0.06] transition-opacity">#{proj.id}</span>
                            </div>

                            <div className="flex-1 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black tracking-tight uppercase">
                                            {proj.type}
                                        </span>
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest",
                                            proj.status === 'Monitoring' ? "text-green-500" : "text-amber-500"
                                        )}>
                                            <div className={cn("w-2 h-2 rounded-full", proj.status === 'Monitoring' ? "bg-green-500 animate-pulse" : "bg-amber-500")}></div>
                                            {proj.status}
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter group-hover:text-green-600 transition-colors">
                                        {proj.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase">
                                        <MapPin className="w-4 h-4" />
                                        {proj.location}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50/50 p-6 rounded-3xl">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block mb-2">装机规模</span>
                                        <span className="text-2xl font-black text-slate-900">{proj.capacity}</span>
                                        <span className="text-xs font-bold text-slate-300 ml-1">{proj.unit}</span>
                                    </div>
                                    <div className="bg-slate-50/50 p-6 rounded-3xl">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block mb-2">预测 IRR</span>
                                        <span className="text-2xl font-black text-green-600">{proj.irr}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full md:w-px h-px md:h-auto bg-slate-50"></div>

                            <div className="flex flex-col justify-between items-center md:w-32 gap-6">
                                <div className="text-center">
                                    <span className="text-slate-400 text-[8px] font-black uppercase tracking-widest block mb-1">今日发电量</span>
                                    <span className="text-lg font-black text-slate-900">{proj.dailyYield}</span>
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                    <button className="w-full p-4 bg-slate-900 text-white rounded-2xl hover:bg-green-500 transition-all flex items-center justify-center">
                                        <ArrowUpRight className="w-5 h-5" />
                                    </button>
                                    <button className="w-full p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:border-slate-900 hover:text-slate-900 transition-all flex items-center justify-center">
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Engagement Hook: AI Advisor */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-[64px] p-12 md:p-20 text-white relative overflow-hidden shadow-2xl shadow-green-500/20">
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="max-w-xl space-y-6">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-green-200" />
                            </div>
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">
                                发现资产中隐藏的 <span className="text-green-100">超额收益</span>
                            </h2>
                            <p className="text-green-50 font-medium text-xl opacity-80 leading-relaxed">
                                我们的 AI 专家已为您当前的 3 个项目生成了 12 项优化建议，预计可将整体 IRR 提升至 17.5%。
                            </p>
                            <button className="bg-white text-green-700 px-10 py-5 rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3">
                                开启 AI 深度诊断 <ArrowUpRight className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="hidden lg:block relative">
                            <div className="w-80 h-80 bg-white/5 rounded-full flex items-center justify-center animate-pulse">
                                <div className="w-64 h-64 bg-white/10 rounded-full flex items-center justify-center">
                                    <Activity className="w-32 h-32 text-white/40" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Background Noise/Grid */}
                    <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/graphy.png')]"></div>
                </div>
            </main>
        </div>
    );
}
