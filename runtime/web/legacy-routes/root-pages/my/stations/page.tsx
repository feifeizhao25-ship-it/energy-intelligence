'use client';

import React from 'react';
import Link from 'next/link';
import {
    Zap,
    Wind,
    Battery,
    AlertTriangle,
    CheckCircle2,
    Activity,
    ChevronRight,
    Settings,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MyStations() {
    const stations = [
        {
            id: 1,
            type: 'solar',
            name: '保定华源工商业 1.2MW 分布式光伏',
            status: 'online',
            todayGen: '3,850',
            monthGen: '82,400',
            health: 98,
            location: '河北省保定市竞秀区',
            alerts: []
        },
        {
            id: 2,
            type: 'wind',
            name: '张家口崇礼乡村 50MW 分布式风电',
            status: 'online',
            todayGen: '12.4万',
            monthGen: '286万',
            health: 92,
            location: '河北省张家口市崇礼区',
            alerts: [
                { type: 'warning', message: '3号机位风速计异常，建议检查' }
            ]
        },
        {
            id: 3,
            type: 'solar',
            name: '自家屋顶 20kW 光伏电站',
            status: 'error',
            todayGen: '12',
            monthGen: '450',
            health: 45,
            location: '山东省淄博市临淄区',
            alerts: [
                { type: 'danger', message: '逆变器 02 通讯中断，请立即处理' }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-4 md:px-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900">我的电站</h1>
                        <p className="text-slate-500 font-medium">实时监测您的所有新能源资产运行状态</p>
                    </div>
                    <button className="bg-green-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-600 transition-all shadow-xl shadow-green-200">
                        <Plus className="w-5 h-5" />
                        接入新电站
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 左侧：列表 */}
                    <div className="lg:col-span-2 space-y-6">
                        {stations.map((station) => (
                            <div
                                key={station.id}
                                className="bg-white rounded-[32px] border border-slate-100 p-8 hover:shadow-xl transition-all group"
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <div className="flex gap-4">
                                        <div className={cn(
                                            "p-4 rounded-2xl",
                                            station.type === 'solar' ? "bg-solar-50 text-solar-600" : "bg-wind-50 text-wind-600"
                                        )}>
                                            {station.type === 'solar' ? <Zap /> : <Wind />}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{station.name}</h3>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                                <CheckCircle2 className={cn("w-3 h-3", station.status === 'online' ? "text-green-500" : "text-red-500")} />
                                                <span className="uppercase tracking-widest">{station.status === 'online' ? '运行正常' : '故障告警'}</span>
                                                <span className="mx-2 opacity-50">•</span>
                                                <span>{station.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="p-2 text-slate-300 hover:text-slate-900"><Settings className="w-5 h-5" /></button>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mb-8">
                                    <div className="bg-slate-50 p-6 rounded-2xl">
                                        <div className="text-xs font-bold text-slate-400 mb-1">今日发电 (度)</div>
                                        <div className="text-2xl font-black text-slate-900">{station.todayGen}</div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-2xl">
                                        <div className="text-xs font-bold text-slate-400 mb-1">本月发电 (度)</div>
                                        <div className="text-2xl font-black text-slate-900">{station.monthGen}</div>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-2xl">
                                        <div className="text-xs font-bold text-slate-400 mb-1">健康评分</div>
                                        <div className={cn(
                                            "text-2xl font-black",
                                            station.health > 90 ? "text-green-500" : "text-amber-500"
                                        )}>{station.health}</div>
                                    </div>
                                </div>

                                {station.alerts.length > 0 && (
                                    <div className="mb-8 space-y-2">
                                        {station.alerts.map((alert, i) => (
                                            <div key={i} className={cn(
                                                "flex items-center gap-3 p-4 rounded-xl border",
                                                alert.type === 'warning' ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-red-50 border-red-100 text-red-700"
                                            )}>
                                                <AlertTriangle className="w-4 h-4" />
                                                <span className="text-sm font-bold">{alert.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Link
                                    href={`/my/stations/${station.id}`}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900 text-white font-bold group-hover:bg-green-600 transition-colors"
                                >
                                    查看实时曲线与诊断详情
                                    <ChevronRight className="w-5 h-5" />
                                </Link>
                            </div>
                        ))}
                    </div>

                    {/* 右侧：统计概况 */}
                    <div className="space-y-8">
                        <div className="bg-slate-900 rounded-[40px] p-8 text-white space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Activity className="w-24 h-24" />
                            </div>

                            <h3 className="text-xl font-black relative z-10">资产概况</h3>

                            <div className="space-y-6 relative z-10">
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-slate-400 text-sm font-bold">累计发电量</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-white">412.5 <span className="text-sm font-normal">万度</span></div>
                                        <div className="text-green-400 text-xs font-bold">相当于种树 1.2万棵</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-slate-400 text-sm font-bold">累计总收益</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-white">¥ 328.6 <span className="text-sm font-normal">万</span></div>
                                        <div className="text-blue-400 text-xs font-bold">已覆盖项目投资 42.5%</div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 relative z-10">
                                <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">资产分布</div>
                                <div className="flex h-3 rounded-full overflow-hidden bg-white/10">
                                    <div className="bg-solar-500 w-[65%]" title="光伏 65%"></div>
                                    <div className="bg-wind-500 w-[25%]" title="风电 25%"></div>
                                    <div className="bg-storage-500 w-[10%]" title="储能 10%"></div>
                                </div>
                                <div className="flex justify-between mt-3 text-[10px] font-black uppercase text-slate-400">
                                    <span>☀️ 光伏 65%</span>
                                    <span>💨 风电 25%</span>
                                    <span>🔋 储能 10%</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-50 rounded-[40px] p-8 border border-green-100">
                            <h4 className="text-green-700 font-bold mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 font-black uppercase tracking-widest" />
                                智能运维助手 (AI)
                            </h4>
                            <p className="text-green-600/70 text-sm leading-relaxed mb-6">
                                基于气象预报与发电规律分析，建议您：
                            </p>
                            <div className="space-y-3">
                                <div className="bg-white p-4 rounded-2xl text-sm font-bold text-slate-700 shadow-sm">
                                    🔍 华源光伏站建议在 2天后进行组件清洗
                                </div>
                                <div className="bg-white p-4 rounded-2xl text-sm font-bold text-slate-700 shadow-sm">
                                    ⚠️ 崇礼风电站 3号机位建议本周进行例行检查
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShieldCheck(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
