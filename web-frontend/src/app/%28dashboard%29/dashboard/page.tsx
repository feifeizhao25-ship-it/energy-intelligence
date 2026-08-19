'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Zap,
    Wind,
    Battery,
    Sparkles,
    MapPin,
    ArrowRight,
    Calculator,
    TrendingUp,
    TrendingDown,
    Sun,
    Cloud,
    Droplets,
    Leaf,
    Coins,
    Home,
    Building2,
    Users,
    Award,
    FileText,
    Settings,
    Bell,
    ChevronRight,
    Target,
    Flame,
    Calendar,
    BarChart3,
    Activity,
    Eye,
    Download,
    Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock user data - 实际应从API获取
const mockUserData = {
    name: '张先生',
    isPro: false,
    stats: {
        totalGeneration: 15680,
        todayGeneration: 62.5,
        monthGeneration: 1850,
        yearGeneration: 12500,
        totalRevenue: 52800,
        todayRevenue: 215,
        carbonReduction: 8920,
        stationCount: 2
    },
    recentStations: [
        { id: '1', name: '保定市区屋顶光伏', type: 'solar', capacity: 15, todayGen: 62.5, efficiency: 94.5, status: 'healthy' },
        { id: '2', name: '工厂储能系统', type: 'storage', capacity: 100, todayGen: 0, efficiency: 89.3, status: 'warning' }
    ],
    monthlyData: [
        { month: '7月', gen: 1250, rev: 4200 },
        { month: '8月', gen: 1380, rev: 4650 },
        { month: '9月', gen: 1100, rev: 3700 },
        { month: '10月', gen: 950, rev: 3200 },
        { month: '11月', gen: 780, rev: 2650 },
        { month: '12月', gen: 650, rev: 2200 }
    ],
    notifications: 3,
    streakDays: 12
};

const mockQuickActions = [
    { id: 'calc', title: '光伏测算', icon: Zap, color: 'amber', link: '/calculator/solar', desc: '快速评估' },
    { id: 'wind', title: '风电测算', icon: Wind, color: 'cyan', link: '/calculator/wind', desc: '效益分析' },
    { id: 'storage', title: '储能测算', icon: Battery, color: 'emerald', link: '/calculator/storage', desc: '峰谷套利' },
    { id: 'report', title: '生成报告', icon: FileText, color: 'purple', link: '/my/stations', desc: '专业分析' },
];

const mockNavItems = [
    { id: 'stations', title: '我的电站', icon: Home, count: 2, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'community', title: '问答社区', icon: Users, count: 0, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'papers', title: '文献检索', icon: FileText, count: 0, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'maintenance', title: '运维诊断', icon: Settings, count: 1, color: 'text-green-500', bg: 'bg-green-50' },
];

export default function DashboardPage() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [data] = useState(mockUserData);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pt-6 pb-20 px-4">
                <div className="max-w-md mx-auto">
                    {/* User Info */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-xl font-black">{data.name[0]}</span>
                            </div>
                            <div>
                                <div className="font-bold text-lg">你好，{data.name}</div>
                                <div className="flex items-center gap-1 text-slate-400 text-xs">
                                    <MapPin className="w-3 h-3" />
                                    保定市
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {data.streakDays > 0 && (
                                <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 rounded-full">
                                    <Flame className="w-4 h-4 text-orange-400" />
                                    <span className="text-xs font-bold">{data.streakDays}天</span>
                                </div>
                            )}
                            <Link href="/settings" className="p-2 bg-white/10 rounded-xl">
                                <Settings className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>

                    {/* Pro Banner */}
                    {!data.isPro && (
                        <Link href="/pricing" className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-500/20 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">升级专业版</div>
                                    <div className="text-xs text-white/70">解锁无限测算 & AI分析</div>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-white/70" />
                        </Link>
                    )}
                </div>
            </div>

            {/* Main Content - Overlapping Cards */}
            <div className="max-w-md mx-auto px-4 -mt-12 space-y-4">

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Sun className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="text-xs text-slate-400">今日发电</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{data.stats.todayGeneration}</div>
                        <div className="text-xs text-slate-400">kWh</div>
                        <div className="flex items-center gap-1 mt-2 text-green-500 text-xs font-bold">
                            <TrendingUp className="w-3 h-3" />
                            +12.5%
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                                <Coins className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="text-xs text-slate-400">今日收益</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">¥{data.stats.todayRevenue}</div>
                        <div className="text-xs text-slate-400">预估收入</div>
                        <div className="flex items-center gap-1 mt-2 text-green-500 text-xs font-bold">
                            <TrendingUp className="w-3 h-3" />
                            +8.3%
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Leaf className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-xs text-slate-400">碳减排</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{data.stats.carbonReduction}</div>
                        <div className="text-xs text-slate-400">kg CO₂</div>
                        <div className="flex items-center gap-1 mt-2 text-green-500 text-xs font-bold">
                            <Activity className="w-3 h-3" />
                            相当于种树{Math.floor(data.stats.carbonReduction / 5)}棵
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-purple-600" />
                            </div>
                            <span className="text-xs text-slate-400">电站数量</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">{data.stats.stationCount}</div>
                        <div className="text-xs text-slate-400">个电站</div>
                        <div className="flex items-center gap-1 mt-2 text-slate-400 text-xs">
                            <Target className="w-3 h-3" />
                            总容量 {data.recentStations.reduce((acc, s) => acc + s.capacity, 0)}kW
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-slate-900">快速操作</span>
                        <Link href="/calculator" className="text-xs text-green-600 font-bold flex items-center gap-0.5">
                            更多
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {mockQuickActions.map(action => (
                            <Link
                                key={action.id}
                                href={action.link}
                                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    action.color === 'amber' && "bg-amber-100",
                                    action.color === 'cyan' && "bg-cyan-100",
                                    action.color === 'emerald' && "bg-emerald-100",
                                    action.color === 'purple' && "bg-purple-100"
                                )}>
                                    <action.icon className={cn(
                                        "w-5 h-5",
                                        action.color === 'amber' && "text-amber-600",
                                        action.color === 'cyan' && "text-cyan-600",
                                        action.color === 'emerald' && "text-emerald-600",
                                        action.color === 'purple' && "text-purple-600"
                                    )} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-700">{action.title}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Monthly Chart Preview */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-slate-900">月度发电趋势</span>
                        <div className="flex gap-2">
                            <button className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">月</button>
                            <button className="px-2 py-1 text-xs font-bold text-slate-400">年</button>
                        </div>
                    </div>
                    <div className="h-32 flex items-end justify-between gap-1">
                        {data.monthlyData.map((item, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                    className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all hover:from-green-600 hover:to-green-500"
                                    style={{ height: `${(item.gen / 1500) * 100}%`, minHeight: '8px' }}
                                />
                                <span className="text-[8px] text-slate-400">{item.month.replace('月', '')}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Stations */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-slate-900">我的电站</span>
                        <Link href="/my/stations" className="text-xs text-green-600 font-bold flex items-center gap-0.5">
                            查看全部
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {data.recentStations.map(station => (
                            <div
                                key={station.id}
                                className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                            station.type === 'solar' && "bg-amber-100",
                                            station.type === 'storage' && "bg-emerald-100"
                                        )}>
                                            {station.type === 'solar' ? (
                                                <Sun className="w-4 h-4 text-amber-600" />
                                            ) : (
                                                <Battery className="w-4 h-4 text-emerald-600" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm text-slate-900">{station.name}</div>
                                            <div className="text-xs text-slate-400">{station.capacity}kW · 效率{station.efficiency}%</div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        station.status === 'healthy' ? "bg-green-500" : "bg-amber-500"
                                    )} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                        <span className="text-slate-400">今日发电：</span>
                                        <span className="font-bold text-slate-900">{station.todayGen} kWh</span>
                                    </div>
                                    <button className="text-xs text-green-600 font-bold flex items-center gap-0.5">
                                        <Eye className="w-3 h-3" />
                                        详情
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation Grid */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="grid grid-cols-4 gap-2">
                        {mockNavItems.map(item => (
                            <Link
                                key={item.id}
                                href={item.id === 'stations' ? '/my/stations' :
                                    item.id === 'community' ? '/community' :
                                        item.id === 'papers' ? '/papers' :
                                            '/maintenance'}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", item.bg)}>
                                    <item.icon className={cn("w-5 h-5", item.color)} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 text-center">{item.title}</span>
                                {item.count > 0 && (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                                        {item.count}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* AI Assistant */}
                <Link href="/assistant" className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-purple-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold">AI能源助手</div>
                                <div className="text-xs text-white/70">解答所有新能源问题</div>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/70" />
                    </div>
                </Link>

                {/* Daily Quote */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Target className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <div className="font-bold text-green-900 text-sm mb-1">今日目标</div>
                            <p className="text-xs text-green-700">
                                继续记录发电数据，已连续 {data.streakDays} 天！坚持就是胜利。
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Stats - 改为可折叠设计 */}
            <div className="fixed bottom-4 left-4 right-4 z-40 md:left-1/2 md:-translate-x-1/2 md:w-auto md:max-w-md">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 py-3 px-6">
                    <div className="flex items-center justify-around gap-4">
                        <div className="text-center">
                            <div className="text-lg font-black text-slate-900">{data.stats.totalGeneration.toLocaleString()}</div>
                            <div className="text-[10px] text-slate-400">总发电(kWh)</div>
                        </div>
                        <div className="w-px h-8 bg-slate-200" />
                        <div className="text-center">
                            <div className="text-lg font-black text-green-600">¥{(data.stats.totalRevenue / 10000).toFixed(1)}万</div>
                            <div className="text-[10px] text-slate-400">总收入(元)</div>
                        </div>
                        <div className="w-px h-8 bg-slate-200 hidden sm:block" />
                        <div className="text-center hidden sm:block">
                            <div className="text-lg font-black text-blue-600">{data.stats.carbonReduction}</div>
                            <div className="text-[10px] text-slate-400">碳减排(kg)</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
