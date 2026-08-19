'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Zap,
    Wind,
    Battery,
    Search,
    Filter,
    Calendar,
    ChevronRight,
    MoreVertical,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MyProjects() {
    const [filter, setFilter] = useState<'all' | 'solar' | 'wind' | 'storage'>('all');

    const projects = [
        {
            id: 1,
            type: 'solar',
            name: '山东淄博工商业屋顶项目',
            date: '2026-01-12',
            scale: '1.2 MW',
            irr: '18.5%',
            income: '¥ 850万',
            status: '已保存'
        },
        {
            id: 2,
            type: 'wind',
            name: '河北张家口乡村风电测算',
            date: '2026-01-11',
            scale: '50 MW',
            irr: '15.2%',
            income: '¥ 2800元/人/年',
            status: '推荐中'
        },
        {
            id: 3,
            type: 'storage',
            name: '江苏苏州工厂储能套利方案',
            date: '2026-01-10',
            scale: '500 kWh',
            irr: '23.5%',
            income: '¥ 42.5万/年',
            status: '已保存'
        },
        {
            id: 4,
            type: 'solar',
            name: '广东东莞分布式户用光伏',
            date: '2026-01-08',
            scale: '20 kW',
            irr: '12.8%',
            income: '¥ 12万',
            status: '已保存'
        }
    ];

    const filteredProjects = filter === 'all'
        ? projects
        : projects.filter(p => p.type === filter);

    const getIcon = (type: string) => {
        switch (type) {
            case 'solar': return <Zap className="w-5 h-5 text-solar-600" />;
            case 'wind': return <Wind className="w-5 h-5 text-wind-600" />;
            case 'storage': return <Battery className="w-5 h-5 text-storage-600" />;
            default: return <Zap className="w-5 h-5 text-slate-600" />;
        }
    };

    const getBg = (type: string) => {
        switch (type) {
            case 'solar': return "bg-solar-50 border-solar-100";
            case 'wind': return "bg-wind-50 border-wind-100";
            case 'storage': return "bg-storage-50 border-storage-100";
            default: return "bg-slate-50 border-slate-100";
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-4 md:px-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900">我的项目</h1>
                        <p className="text-slate-500 font-medium">管理您保存的所有测算结果与方案</p>
                    </div>
                    <Link href="/" className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                        <Plus className="w-5 h-5" />
                        新建测算
                    </Link>
                </div>

                <div className="flex flex-col md:flex-row gap-6 mb-8">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="搜索项目名称..."
                            className="w-full bg-white border border-slate-200 p-4 pl-12 rounded-2xl outline-none focus:border-green-500 transition-all font-medium"
                        />
                    </div>
                    <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl gap-1">
                        {[
                            { id: 'all', label: '全部' },
                            { id: 'solar', label: '光伏' },
                            { id: 'wind', label: '风电' },
                            { id: 'storage', label: '储能' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setFilter(btn.id as any)}
                                className={cn(
                                    "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                                    filter === btn.id ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                                )}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredProjects.map((project) => (
                        <div
                            key={project.id}
                            className="bg-white rounded-[32px] border border-slate-100 p-8 hover:shadow-xl transition-all group relative overflow-hidden"
                        >
                            {/* Accent Decor */}
                            <div className={cn(
                                "absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700",
                                project.type === 'solar' && "bg-solar-500",
                                project.type === 'wind' && "bg-wind-500",
                                project.type === 'storage' && "bg-storage-500"
                            )}></div>

                            <div className="flex justify-between items-start mb-6">
                                <div className={cn("p-3 rounded-2xl border", getBg(project.type))}>
                                    {getIcon(project.type)}
                                </div>
                                <button className="text-slate-300 hover:text-slate-900 p-2">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2 mb-8">
                                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                                    <Calendar className="w-3 h-3" />
                                    {project.date}
                                </div>
                                <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-green-600 transition-colors">
                                    {project.name}
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-8 py-6 border-y border-slate-50">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">规模</div>
                                    <div className="text-lg font-black text-slate-900">{project.scale}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">预期收益</div>
                                    <div className="text-lg font-black text-slate-900">{project.income}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">预期 IRR</div>
                                    <div className={cn(
                                        "text-lg font-black",
                                        project.type === 'solar' && "text-solar-600",
                                        project.type === 'wind' && "text-wind-600",
                                        project.type === 'storage' && "text-storage-600"
                                    )}>{project.irr}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">当前状态</div>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                        {project.status}
                                    </span>
                                </div>
                            </div>

                            <Link
                                href={`/quick-calc/result/${project.type}`}
                                className="flex items-center justify-between group-hover:px-2 transition-all"
                            >
                                <span className="font-black text-slate-900 text-sm">查看深度报告</span>
                                <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>

                {filteredProjects.length === 0 && (
                    <div className="bg-white rounded-[40px] p-20 text-center space-y-6 border border-slate-100">
                        <div className="bg-slate-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-slate-200">
                            <Search className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900">未找到相关项目</h3>
                            <p className="text-slate-500 font-medium">试试切换分类或搜索其他关键词</p>
                        </div>
                        <button onClick={() => setFilter('all')} className="text-blue-600 font-bold hover:underline">显示全部项目</button>
                    </div>
                )}
            </div>
        </div>
    );
}
