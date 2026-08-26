'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PersonalizedGreeting } from '@/components/personalization/Greeting';
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
    { id: 'stations', title: '我的电站', icon: Home, count: 2, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { id: 'community', title: '问答社区', icon: Users, count: 0, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'papers', title: '文献检索', icon: FileText, count: 0, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { id: 'maintenance', title: '运维诊断', icon: Settings, count: 1, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
];

import { SiteWizard } from '@/components/dashboard/site-wizard/SiteWizard';
import { NextStepsPanel } from '@/components/orchestrator/NextStepsPanel';

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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pt-6 pb-24 px-4">
                <div className="max-w-xl mx-auto">
                    {/* User Info */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-xl font-black text-slate-900">{data.name[0]}</span>
                            </div>
                            <div>
                                <div className="font-bold text-lg">你好，{data.name}</div>
                                <div className="flex items-center gap-1 text-slate-400 text-xs">
                                    <MapPin className="w-3 h-3" />
                                    保定市 · {data.isPro ? '专业版用户' : '基础版'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {data.streakDays > 0 && (
                                <div className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 rounded-full border border-orange-500/30">
                                    <Flame className="w-4 h-4 text-orange-400" />
                                    <span className="text-xs font-bold text-orange-400">{data.streakDays}天</span>
                                </div>
                            )}
                            <Link href="/settings" className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                                <Settings className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-2 text-center">
                        <h1 className="text-3xl font-black tracking-tight">新能源项目<span className="text-green-400">一键选址</span></h1>
                        <p className="text-slate-400 text-sm">30分钟完成项目内投决策</p>
                    </div>
                </div>
            </div>

            {/* Main Content - Wizard */}
            <div className="max-w-2xl mx-auto px-4 -mt-10 space-y-8">
                <PersonalizedGreeting />
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800">
                    <SiteWizard />
                </div>

                {/* 项目下一步推荐 - 编排器 */}
                <div className="space-y-3">
                    <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2 px-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        智能推荐
                    </h2>
                    <NextStepsPanel projectId="current" compact />
                </div>

                {/* Secondary Section - Stats & My Stations */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            数据概览
                        </h2>
                        <Link href="/my/stations" className="text-xs text-slate-400 font-bold hover:text-green-500 transition-colors">
                            查看详细报表 &gt;
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
                                    <Sun className="w-5 h-5 text-amber-600" />
                                </div>
                                <span className="text-xs font-bold text-slate-500">累计发电量</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {(data.stats.totalGeneration / 1000).toFixed(1)} <small className="text-xs font-normal text-slate-400 tracking-normal">MWh</small>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center">
                                    <Coins className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="text-xs font-bold text-slate-500">累计总收益</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                ¥{(data.stats.totalRevenue / 10000).toFixed(1)} <small className="text-xs font-normal text-slate-400 tracking-normal">万</small>
                            </div>
                        </div>
                    </div>

                    {/* Features Grid */}
                    <div className="grid grid-cols-4 gap-3">
                        {mockNavItems.map(item => (
                            <Link
                                key={item.id}
                                href={item.id === 'stations' ? '/my/stations' :
                                    item.id === 'community' ? '/community' :
                                        item.id === 'papers' ? '/papers' :
                                            '/maintenance'}
                                className="bg-white dark:bg-slate-800 p-4 rounded-3xl flex flex-col items-center gap-2 shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-105 transition-transform"
                            >
                                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", item.bg)}>
                                    <item.icon className={cn("w-5 h-5", item.color)} />
                                </div>
                                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{item.title}</span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Bottom Banner */}
                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-[2.5rem] p-8 border border-green-500/20 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-500 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-green-500/20">
                        <Award className="w-8 h-8 text-slate-900" />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 dark:text-white">想要获取更详细的工程建议？</h4>
                        <p className="text-xs text-slate-500 mt-1">我们的 AI 专家团队已为您准备了针对性的项目优化方案。</p>
                    </div>
                    <Link href="/pricing" className="inline-block bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors">
                        立即升级专业版
                    </Link>
                </div>
            </div>
        </div>
    );
}
