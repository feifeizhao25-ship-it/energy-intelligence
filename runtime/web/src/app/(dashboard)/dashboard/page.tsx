'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Zap,
    Wind,
    Battery,
    Sparkles,
    ArrowRight,
    FileText,
    Settings,
    ChevronRight,
    Target,
    TrendingUp,
    BarChart3,
    Activity,
    Bell,
    Calendar,
    LineChart,
    Layers,
    Plug,
    Landmark,
    Gauge,
    ClipboardList,
    CloudOff,
    RefreshCw,
    BadgeAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// 数据来源：GET /api/dashboard —— 只包含当前登录用户自己的项目、测算、电站、额度。
// 原来这里对每个用户都展示内置演示人设（「你好，陈欣」「第 1 天」），
// 真实用户打开工作台看到的是一位虚构用户的名字和内容。
// ---------------------------------------------------------------------------

interface PersonalDashboard {
    greeting: string;
    plan: { code: string; expiresAt: string | null; expiringSoon: boolean };
    counts: { projects: number; calculations: number; savedPapers: number; stations: number };
    recentProjects: { id: string; name: string; type: string; capacity: number | null; reportStatus: string; updatedAt: string }[];
    stationAlerts: { id: string; name: string; status: string; lastUpdated: string | null }[];
    usage: { type: string; used: number; limit: number }[];
    nextActions: { id: string; title: string; reason: string; href: string }[];
}

const PLAN_NAMES: Record<string, string> = {
    FREE: '免费版', PRO: '专业版', MAINTENANCE: '运维版', FULL: '全能版', TEAM: '团队版', ENTERPRISE: '企业版',
};
const TYPE_LABEL: Record<string, string> = { SOLAR: '光伏', WIND: '风电', STORAGE: '储能' };

// 静态导航（非编造数据，沿用原页面设计）
const quickActions = [
    { id: 'calc', title: '光伏测算', titleEn: 'Solar calc', icon: Zap, color: 'amber', link: '/calculator/solar' },
    { id: 'wind', title: '风电测算', titleEn: 'Wind calc', icon: Wind, color: 'cyan', link: '/calculator/wind' },
    { id: 'storage', title: '储能测算', titleEn: 'Storage calc', icon: Battery, color: 'emerald', link: '/calculator/storage' },
    { id: 'report', title: '生成报告', titleEn: 'Reports', icon: FileText, color: 'purple', link: '/my/stations' },
];

function DashboardContent() {
    const [data, setData] = useState<PersonalDashboard | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    const load = useCallback(async () => {
        setStatus('loading');
        try {
            const res = await fetch('/api/dashboard', { cache: 'no-store' });
            const body = await res.json();
            if (!res.ok || !body?.data) throw new Error('dashboard');
            setData(body.data as PersonalDashboard);
            setStatus('ready');
        } catch {
            setData(null);
            setStatus('error');
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const paid = data && data.plan.code !== 'FREE';

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pt-6 pb-20 px-4">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Target className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">{data ? data.greeting : '我的工作台'}</div>
                                {data && (
                                    <div className="text-slate-400 text-xs">
                                        {PLAN_NAMES[data.plan.code] ?? data.plan.code}
                                        {data.plan.expiresAt && ` · ${data.plan.expiresAt.slice(0, 10)} 到期`}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Link href="/settings" className="p-2 bg-white/10 rounded-xl" aria-label="设置">
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>

                    {data && (
                        <div className="grid grid-cols-4 gap-2 mb-5 text-center">
                            {[
                                ['项目', data.counts.projects],
                                ['测算', data.counts.calculations],
                                ['文献', data.counts.savedPapers],
                                ['电站', data.counts.stations],
                            ].map(([label, value]) => (
                                <div key={label as string} className="rounded-xl bg-white/10 py-2">
                                    <div className="text-lg font-black tabular-nums">{value}</div>
                                    <div className="text-[11px] text-slate-400">{label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!paid && (
                        <Link href="/pricing" className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-500/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-sm">升级专业版</div>
                                    <div className="text-xs text-white/70">更多测算与 AI 分析额度</div>
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-white/70" />
                        </Link>
                    )}
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 -mt-12 space-y-4">
                {status === 'error' || !data ? (
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <CloudOff className="w-7 h-7 text-slate-400" />
                        </div>
                        <div className="font-bold text-slate-900 mb-1">工作台暂时无法加载</div>
                        <p className="text-xs text-slate-400 mb-5">请稍后重试；如果刚刚登录，可刷新页面。</p>
                        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors">
                            <RefreshCw className="w-4 h-4" />重试
                        </button>
                    </div>
                ) : (
                    <>
                        {data.nextActions.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                <div className="font-bold text-slate-900 mb-1">接下来可以做</div>
                                <p className="text-[11px] text-slate-400 mb-2">根据你自己的项目、测算与额度生成</p>
                                <div className="divide-y divide-slate-100">
                                    {data.nextActions.map(action => (
                                        <Link key={action.id} href={action.href} className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                                            <div>
                                                <div className="text-sm text-slate-800 font-bold">{action.title}</div>
                                                <div className="text-xs text-slate-400">{action.reason}</div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.stationAlerts.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-100">
                                <div className="flex items-center gap-2 font-bold text-slate-900 mb-2"><Bell className="w-4 h-4 text-rose-500" />电站告警</div>
                                {data.stationAlerts.map(s => (
                                    <div key={s.id} className="flex justify-between py-1 text-sm">
                                        <span className="text-slate-700">{s.name}</span>
                                        <span className={s.status === 'fault' ? 'text-rose-600 font-bold' : 'text-amber-600 font-bold'}>{s.status === 'fault' ? '故障' : '告警'}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-900">最近的项目</span>
                                <Link href="/projects" className="text-xs text-green-600 font-bold flex items-center gap-0.5">全部<ChevronRight className="w-3 h-3" /></Link>
                            </div>
                            {data.recentProjects.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">还没有项目。做一次测算并保存，就会出现在这里。</p>
                            ) : data.recentProjects.map(p => (
                                <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between py-2 text-sm hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                                    <span className="text-slate-800 font-medium">{p.name}</span>
                                    <span className="text-xs text-slate-400">{TYPE_LABEL[p.type] ?? p.type}{p.capacity ? ` · ${p.capacity} kW` : ''}</span>
                                </Link>
                            ))}
                        </div>

                        {data.usage.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                <div className="flex items-center gap-2 font-bold text-slate-900 mb-2"><Gauge className="w-4 h-4 text-green-600" />今日额度</div>
                                {data.usage.map(u => (
                                    <div key={u.type} className="flex justify-between py-1 text-sm">
                                        <span className="text-slate-600">{u.type}</span>
                                        <span className={cn('tabular-nums font-bold', u.used >= u.limit ? 'text-rose-600' : 'text-slate-800')}>{u.used} / {u.limit}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* Quick Actions（静态导航） */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-slate-900">快速操作</span>
                        <Link href="/calculator" className="text-xs text-green-600 font-bold flex items-center gap-0.5">
                            更多
                            <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {quickActions.map(action => (
                            <Link
                                key={action.id}
                                href={action.link}
                                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                <div className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center',
                                    action.color === 'amber' && 'bg-amber-100',
                                    action.color === 'cyan' && 'bg-cyan-100',
                                    action.color === 'emerald' && 'bg-emerald-100',
                                    action.color === 'purple' && 'bg-purple-100'
                                )}>
                                    <action.icon className={cn(
                                        'w-5 h-5',
                                        action.color === 'amber' && 'text-amber-600',
                                        action.color === 'cyan' && 'text-cyan-600',
                                        action.color === 'emerald' && 'text-emerald-600',
                                        action.color === 'purple' && 'text-purple-600'
                                    )} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-700">
                                    {action.title}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* AI Assistant（静态导航） */}
                <Link href="/assistant" className="block bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-purple-500/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold">AI 能源助手</div>
                                <div className="text-xs text-white/70">
                                    解答新能源项目问题
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/70" />
                    </div>
                </Link>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
