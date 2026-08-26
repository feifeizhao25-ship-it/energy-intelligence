'use client';

import React from 'react';
import Link from 'next/link';
import {
    Trophy,
    Leaf,
    Zap,
    Wind,
    Star,
    Award,
    Lock,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AchievementsPage() {
    const stats = [
        { label: '累计减排', value: '128.5', unit: '吨', icon: Leaf, color: 'text-green-500' },
        { label: '累计发电', value: '412.5', unit: '万度', icon: Zap, color: 'text-solar-500' },
        { label: '达成成就', value: '18', unit: '项', icon: Trophy, color: 'text-amber-500' },
    ];

    const badges = [
        { id: 1, name: '初露锋芒', desc: '完成首个光伏项目测算', status: 'unlocked', date: '2026-01-05', icon: Award, type: 'silver' },
        { id: 2, name: '碳路先锋', desc: '累计减排超过 10 吨 CO2', status: 'unlocked', date: '2026-01-08', icon: Leaf, type: 'gold' },
        { id: 3, name: '算力达人', desc: '连续 7 天使用 AI 测算工具', status: 'unlocked', date: '2026-01-12', icon: Star, type: 'platinum' },
        { id: 4, name: '风电盟友', desc: '完成 3 个乡村风电测算方案', status: 'locked', desc2: '进度 1/3', icon: Wind, type: 'silver' },
        { id: 5, name: '能效专家', desc: '电站健康评分连续 30 天 > 95', status: 'locked', desc2: '进度 12/30', icon: Zap, type: 'gold' },
        { id: 6, name: '储能之光', desc: '优化一个光储一体化项目收益', status: 'locked', desc2: '未达成', icon: Trophy, type: 'platinum' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-4 md:px-8">
            <div className="max-w-5xl mx-auto space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-4 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            返回
                        </button>
                        <h1 className="text-3xl font-black text-slate-900">成就勋章</h1>
                        <p className="text-slate-500 font-medium">记录您为绿色地球做出的每一份贡献</p>
                    </div>

                    <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 flex items-center gap-4 shadow-sm">
                        <div className="bg-amber-100 p-2 rounded-xl">
                            <Star className="text-amber-600 w-6 h-6 fill-amber-600" />
                        </div>
                        <div>
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest">当前等级</div>
                            <div className="text-xl font-black text-slate-900">LV.7 能效大师</div>
                        </div>
                    </div>
                </div>

                {/* 核心指标 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
                            <div className={cn("p-4 rounded-2xl bg-slate-50", stat.color)}>
                                <stat.icon className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <div className="text-4xl font-black text-slate-900">{stat.value}</div>
                                <div className="text-sm font-bold text-slate-400">{stat.label} ({stat.unit})</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 勋章墙 */}
                <div className="space-y-8">
                    <h2 className="text-2xl font-black text-slate-900">成果勋章</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {badges.map((badge) => (
                            <div
                                key={badge.id}
                                className={cn(
                                    "relative p-8 rounded-[40px] border-2 flex flex-col items-center text-center gap-4 transition-all duration-500 group overflow-hidden",
                                    badge.status === 'unlocked'
                                        ? "bg-white border-slate-100 hover:shadow-2xl hover:-translate-y-2"
                                        : "bg-slate-50/50 border-slate-100 border-dashed opacity-60 grayscale"
                                )}
                            >
                                <div className={cn(
                                    "w-20 h-20 rounded-full flex items-center justify-center relative",
                                    badge.type === 'silver' && "bg-slate-100 text-slate-400",
                                    badge.type === 'gold' && "bg-amber-50 text-amber-500",
                                    badge.type === 'platinum' && "bg-indigo-50 text-indigo-500"
                                )}>
                                    <badge.icon className="w-10 h-10" />
                                    {badge.status === 'locked' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 rounded-full">
                                            <Lock className="w-6 h-6 text-slate-300" />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-black text-slate-900">{badge.name}</h4>
                                    <p className="text-[10px] font-medium text-slate-400 leading-tight">
                                        {badge.status === 'unlocked' ? badge.desc : (badge.desc2 || badge.desc)}
                                    </p>
                                </div>

                                {badge.status === 'unlocked' && (
                                    <div className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-50 px-3 py-1 rounded-full mt-2">
                                        已达成 {badge.date}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 奖励部分 */}
                <div className="bg-slate-900 rounded-[48px] p-10 md:p-16 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Award className="w-64 h-64 text-green-400" />
                    </div>

                    <div className="relative z-10 max-w-2xl space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black">贡献者特权</h2>
                            <p className="text-slate-400 text-lg">
                                您的每一次测算和电站接入都在帮助加速能源转型。作为活跃贡献者，您可以领取专属礼包。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center gap-4">
                                <div className="bg-green-500 p-2 rounded-xl"><ChevronRight className="w-4 h-4 text-white" /></div>
                                <div>
                                    <div className="font-bold">专业版 7天体验券</div>
                                    <div className="text-xs text-slate-500">成就等级达成 LV.5 可领</div>
                                </div>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center gap-4">
                                <div className="bg-slate-700 p-2 rounded-xl text-slate-400"><Lock className="w-4 h-4" /></div>
                                <div>
                                    <div className="font-bold">深度报告抵扣券</div>
                                    <div className="text-xs text-slate-500">累计减排 500吨 可领</div>
                                </div>
                            </div>
                        </div>

                        <button className="bg-white text-slate-900 px-10 py-5 rounded-3xl font-black text-xl hover:bg-green-500 hover:text-white transition-all shadow-xl shadow-white/5">
                            前往兑换中心
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
