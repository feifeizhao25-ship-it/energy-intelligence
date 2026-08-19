'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
// 数据契约：GET {API_BASE}/api/v1/personalization/daily-layout?persona_id=&day=
// 响应 {"code":0,"message":"success","data":{...layout...}}
// ---------------------------------------------------------------------------

interface HeroCard {
    title: string;
    headline: string;
    subtext: string;
    evidence_status: string;
    evidence_note: string;
    day_stage: string;
    next_action: { label: string; href: string };
}

interface WidgetCard {
    id: string;
    priority: number;
    title: string;
    summary: string;
    evidence_status: string;
}

interface RecommendationCard {
    kind: string;
    title: string;
    items: { title: string; href: string }[];
    evidence_status: string;
}

interface DailyLayout {
    persona_id: string;
    display_name: string;
    market: 'cn' | 'global';
    day: number;
    day_stage: string;
    hero: HeroCard;
    widgets: WidgetCard[];
    recommendation: RecommendationCard;
}

// API_BASE 由环境变量配置；后端端点未就绪时页面显示空状态，绝不回退编造数据
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
// 国内版 / 国际版默认人设（auth 会话目前没有 persona 字段，暂按 market 给默认）
const IS_INTL = process.env.NEXT_PUBLIC_APP_EDITION === 'international';
const DEFAULT_PERSONA = IS_INTL ? 'john_smith' : 'chen_xin';

// 人设与天数确定顺序：URL 查询参数（?persona=&day=，demo/预览用）
//   → 用户会话 persona（当前 auth 体系无此字段，跳过）
//   → 按 market 的默认人设
function resolvePersonaDay(searchParams: URLSearchParams): { persona: string; day: number } {
    const persona = searchParams.get('persona') || DEFAULT_PERSONA;
    const parsed = parseInt(searchParams.get('day') || '', 10);
    const day = parsed >= 1 && parsed <= 7 ? parsed : 1;
    return { persona, day };
}

// widget 图标映射（沿用页面原有 lucide 图标风格），未知 id 回退 BarChart3
const WIDGET_ICONS: Record<string, typeof BarChart3> = {
    revenue_trend: TrendingUp,
    yield_overview: Zap,
    policy_feed: Landmark,
    alarm_list: Bell,
    pr_monitor: Gauge,
    maintenance_schedule: Calendar,
    storage_dispatch: Battery,
    arbitrage_window: Activity,
    pipeline_funnel: Layers,
    interconnection_tracker: Plug,
    itc_watch: FileText,
    market_dashboard: LineChart,
    forecast_accuracy: Target,
    report_center: ClipboardList,
};

// 按优先级循环的配色，与原有卡片配色体系一致
const WIDGET_PALETTE = [
    { bg: 'bg-amber-100', text: 'text-amber-600' },
    { bg: 'bg-green-100', text: 'text-green-600' },
    { bg: 'bg-blue-100', text: 'text-blue-600' },
    { bg: 'bg-purple-100', text: 'text-purple-600' },
    { bg: 'bg-cyan-100', text: 'text-cyan-600' },
];

// 静态导航（非编造数据，沿用原页面设计）
const quickActions = [
    { id: 'calc', title: '光伏测算', titleEn: 'Solar calc', icon: Zap, color: 'amber', link: '/calculator/solar' },
    { id: 'wind', title: '风电测算', titleEn: 'Wind calc', icon: Wind, color: 'cyan', link: '/calculator/wind' },
    { id: 'storage', title: '储能测算', titleEn: 'Storage calc', icon: Battery, color: 'emerald', link: '/calculator/storage' },
    { id: 'report', title: '生成报告', titleEn: 'Reports', icon: FileText, color: 'purple', link: '/my/stations' },
];

function DashboardContent() {
    const searchParams = useSearchParams();
    const { persona, day } = resolvePersonaDay(searchParams);

    const [layout, setLayout] = useState<DailyLayout | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    const load = useCallback(async () => {
        setStatus('loading');
        try {
            const res = await fetch(
                `${API_BASE}/api/v1/personalization/daily-layout?persona_id=${encodeURIComponent(persona)}&day=${day}`,
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error(`daily-layout ${res.status}`);
            const body = await res.json();
            if (body?.code !== 0 || !body?.data) throw new Error('daily-layout bad payload');
            setLayout(body.data as DailyLayout);
            setStatus('ready');
        } catch {
            // API 不可达 / 404 / 未知人设：空状态，绝不回退编造数据
            setLayout(null);
            setStatus('error');
        }
    }, [persona, day]);

    useEffect(() => {
        load();
    }, [load]);

    // 文案语言：加载完成后按人设 market，加载前按站点版本
    const lang: 'cn' | 'global' = layout ? layout.market : (IS_INTL ? 'global' : 'cn');
    const t = (cn: string, en: string) => (lang === 'cn' ? cn : en);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pt-6 pb-20 px-4">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <span className="text-xl font-black">
                                    {layout ? layout.display_name[0] : '·'}
                                </span>
                            </div>
                            <div>
                                <div className="font-bold text-lg">
                                    {layout
                                        ? t(`你好，${layout.display_name}`, `Hello, ${layout.display_name}`)
                                        : t('个性化仪表盘', 'Personalized dashboard')}
                                </div>
                                {layout && (
                                    <div className="text-slate-400 text-xs">
                                        {t(`第 ${layout.day} 天`, `Day ${layout.day}`)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Link href="/settings" className="p-2 bg-white/10 rounded-xl">
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>

                    {/* Pro Banner（静态营销位，非编造数据） */}
                    <Link href="/pricing" className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-500/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold text-sm">{t('升级专业版', 'Go Pro')}</div>
                                <div className="text-xs text-white/70">
                                    {t('解锁无限测算 & AI分析', 'Unlimited calcs & AI analysis')}
                                </div>
                            </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-white/70" />
                    </Link>
                </div>
            </div>

            {/* Main Content - Overlapping Cards */}
            <div className="max-w-md mx-auto px-4 -mt-12 space-y-4">

                {status === 'error' || !layout ? (
                    /* 空状态：API 不可达 / 404 / 未知人设 */
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <CloudOff className="w-7 h-7 text-slate-400" />
                        </div>
                        <div className="font-bold text-slate-900 mb-1">
                            {t('个性化内容暂不可用', 'Personalized content is temporarily unavailable')}
                        </div>
                        <p className="text-xs text-slate-400 mb-5">
                            {t(
                                '个性化服务暂时无法连接，请稍后重试。',
                                'The personalization service cannot be reached right now. Please try again later.'
                            )}
                        </p>
                        <button
                            onClick={load}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('重试', 'Retry')}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Hero 卡 */}
                        <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white shadow-lg shadow-green-500/20">
                            <div className="text-xs text-white/70 font-bold mb-1">{layout.hero.title}</div>
                            <div className="font-black text-lg leading-snug mb-2">{layout.hero.headline}</div>
                            <p className="text-sm text-white/80 mb-4">{layout.hero.subtext}</p>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                {layout.hero.next_action?.href && (
                                    <Link
                                        href={layout.hero.next_action.href}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-green-700 text-sm font-bold rounded-xl hover:bg-green-50 transition-colors"
                                    >
                                        {layout.hero.next_action.label}
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                )}
                                {/* 演示数据徽标：必须显示 evidence_note */}
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-400/20 text-amber-200 text-[11px] font-bold rounded-full">
                                    <BadgeAlert className="w-3.5 h-3.5" />
                                    {layout.hero.evidence_note}
                                </span>
                            </div>
                        </div>

                        {/* 按 priority 排序的 widget 卡 */}
                        {[...layout.widgets]
                            .sort((a, b) => a.priority - b.priority)
                            .map((widget, i) => {
                                const Icon = WIDGET_ICONS[widget.id] ?? BarChart3;
                                const palette = WIDGET_PALETTE[i % WIDGET_PALETTE.length];
                                return (
                                    <div key={widget.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', palette.bg)}>
                                                    <Icon className={cn('w-4 h-4', palette.text)} />
                                                </div>
                                                <span className="font-bold text-slate-900 text-sm">{widget.title}</span>
                                            </div>
                                            {widget.evidence_status === 'demo' && (
                                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full border border-amber-100">
                                                    {t('演示数据', 'Demo data')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500">{widget.summary}</p>
                                    </div>
                                );
                            })}

                        {/* 「你可能关心」推荐卡 */}
                        {layout.recommendation?.items?.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-bold text-slate-900">{layout.recommendation.title}</span>
                                    {layout.recommendation.evidence_status === 'demo' && (
                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full border border-amber-100">
                                            {t('演示数据', 'Demo data')}
                                        </span>
                                    )}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {layout.recommendation.items.map(item => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                                        >
                                            <span className="text-sm text-slate-700 font-medium">{item.title}</span>
                                            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Quick Actions（静态导航） */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <span className="font-bold text-slate-900">{t('快速操作', 'Quick actions')}</span>
                        <Link href="/calculator" className="text-xs text-green-600 font-bold flex items-center gap-0.5">
                            {t('更多', 'More')}
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
                                    {t(action.title, action.titleEn)}
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
                                <div className="font-bold">{t('AI能源助手', 'AI energy assistant')}</div>
                                <div className="text-xs text-white/70">
                                    {t('解答所有新能源问题', 'Answers for every clean-energy question')}
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
