'use client';

import React from 'react';
import {
    Wrench,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Zap,
    Settings,
    Eye,
    TrendingDown,
    Calendar,
    ArrowUpRight,
    Clock,
    FileText,
    Sparkles,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MaintenancePage() {
    const healthScore = 94;

    const summaryCards = [
        { label: '系统效率 (PR)', value: '82.4%', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { label: '在线设备', value: '124/128', icon: Zap, color: 'text-green-500', bg: 'bg-green-50' },
        { label: '待处理警告', value: '2', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
        { label: '今日清洗任务', value: '已完成', icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50' },
    ];

    const alerts = [
        { id: 1, type: 'warning', title: '逆变器 #04 通讯异常', desc: '通讯频率降低至 0.2Hz，建议检查光纤接口。', time: '12:45' },
        { id: 2, type: 'critical', title: '汇流箱 #12 电流失配', desc: '支路 3 与支路 4 电流偏差超过 20%，疑似遮挡或组件损坏。', time: '10:30' }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* Header Section */}
            <div className="bg-white border-b border-slate-100 pt-32 pb-12 px-4 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">
                            <Wrench className="w-3 h-3" />
                            Engineering Dashboard
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-none">
                            运维与 <span className="text-emerald-500">智能诊断</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-lg">全量 128 个监控点位，预计本月提效 15.4%</p>
                    </div>

                    <div className="flex gap-4 w-full lg:w-auto">
                        <button className="flex-1 lg:flex-none px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2">
                            <Eye className="w-4 h-4" />
                            开启专家巡检
                        </button>
                        <button className="flex-1 lg:flex-none px-6 py-4 bg-white border border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                            <Settings className="w-4 h-4" />
                            监控设置
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-12 px-4 md:px-8 space-y-12">

                {/* Health Score & Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-slate-900 rounded-[48px] p-12 text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">健康评估 Score</h3>
                            <div className="text-[120px] font-black leading-none tracking-tighter mb-4 text-emerald-500 group-hover:scale-105 transition-transform duration-500">
                                {healthScore}
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400 font-black mb-12">
                                <TrendingDown className="w-5 h-5 rotate-180" />
                                <span>优于 92% 的同规模电站</span>
                            </div>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                基于 AI 模型分析，您的电站当前运行状态极佳。主要功率损耗点集中在 <span className="text-white">清洗间隙</span> 与 <span className="text-white">灰尘遮挡</span>。
                            </p>
                        </div>
                        {/* Decorative circle */}
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full border-[32px] border-emerald-500/10 pointer-events-none"></div>
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-2 gap-6">
                        {summaryCards.map((card, i) => (
                            <div key={i} className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-500/5 transition-all">
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-8 shadow-sm", card.bg)}>
                                    <card.icon className={cn("w-6 h-6", card.color)} />
                                </div>
                                <div className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{card.value}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Alerts & Logs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-4">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                                异常警报记录
                            </h2>
                            <button className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 underline tracking-widest">
                                全部历史
                            </button>
                        </div>

                        <div className="space-y-4">
                            {alerts.map((alert) => (
                                <div key={alert.id} className={cn(
                                    "bg-white p-8 rounded-[40px] border flex gap-6 transition-all group cursor-pointer",
                                    alert.type === 'critical' ? "border-red-100 hover:border-red-200" : "border-slate-100 hover:border-emerald-100"
                                )}>
                                    <div className={cn(
                                        "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                                        alert.type === 'critical' ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-500"
                                    )}>
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{alert.title}</h4>
                                            <span className="text-[10px] font-black text-slate-300">{alert.time}</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-500 leading-relaxed">{alert.desc}</p>
                                        <div className="mt-4 flex gap-2">
                                            <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all">
                                                立即处理
                                            </button>
                                            <button className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                                                误报
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Maintenance Schedule */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-4">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <Calendar className="w-6 h-6 text-emerald-500" />
                                运维计划日程
                            </h2>
                            <button className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-emerald-500/20">
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-white rounded-[48px] border border-slate-100 shadow-sm p-10 space-y-8">
                            {[
                                { title: '年度组串清扫', date: '2026.01.25', status: 'Pending', icon: Clock },
                                { title: '变压器预防性试验', date: '2026.02.10', status: 'Scheduled', icon: FileText },
                                { title: '无人机热斑扫描', date: '2026.02.15', status: 'In Review', icon: Eye }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-6 group cursor-pointer border-b border-slate-50 last:border-0 pb-6 last:pb-0">
                                    <div className="w-14 h-14 bg-slate-50 rounded-3xl flex flex-col items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                        <span className="text-[10px] font-black leading-none">{item.date.split('.')[1]}月</span>
                                        <span className="text-lg font-black leading-none mt-1">{item.date.split('.')[2]}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{item.title}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.status}</span>
                                        </div>
                                    </div>
                                    <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
                                </div>
                            ))}
                        </div>

                        <div className="bg-emerald-500 rounded-[32px] p-8 text-white flex items-center gap-6 relative overflow-hidden group">
                            <div className="relative z-10 p-3 bg-white/20 rounded-2xl">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div className="relative z-10 flex-1">
                                <h4 className="text-sm font-black mb-1">AI 效率优化建议</h4>
                                <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest">
                                    建议在本周三（降水后）安排 A 区清扫，可提升 2.1% 效率。
                                </p>
                            </div>
                            <ArrowUpRight className="relative z-10 w-6 h-6 hover:scale-125 transition-transform" />
                            <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none group-hover:scale-150 transition-transform">
                                <Sparkles className="w-12 h-12" />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
