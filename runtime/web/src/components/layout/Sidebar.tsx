'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useStation } from '@/contexts/StationContext';
import { useSession } from 'next-auth/react';

interface NavItem {
    name: string;
    href?: string;
    icon: string;
    tier: string;
    requiresAuth?: boolean;
    badge?: number | string;
    subItems?: { name: string; href: string }[];
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

export default function Sidebar() {
    const { data: session } = useSession() as any;
    const { issues } = useStation();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    // 登录态直接取 useSession（AuthProvider 在未配置时挂载空会话），
    // 不再裸 fetch /api/auth/session——未配置时该接口 fail-closed 返回 503。
    const isLoggedIn = !!session?.user;

    const unresolvedIssuesCount = issues.filter(i => !i.solved && (i.severity === 'error' || i.severity === 'warning')).length;

    // 导航项 - 按用户层级和业务逻辑分组
    const navGroups = [
        {
            label: '主控制台',
            items: [
                { name: '测算首页', href: '/dashboard', icon: 'bolt', tier: 'L1' },
                { name: 'AI 能源专家', href: '/assistant', icon: 'smart_toy', tier: 'L1' },
                { name: '资源地图', href: '/map', icon: 'map', tier: 'L2' },
            ]
        },
        {
            label: '资产中心',
            items: [
                { name: '能源资产', href: '/my/stations', icon: 'battery_charging_full', tier: 'L3', requiresAuth: true },
                { name: '运维诊断', href: '/maintenance', icon: 'build', tier: 'L3', requiresAuth: true, badge: unresolvedIssuesCount > 0 ? unresolvedIssuesCount : undefined },
                { name: '项目日志', href: '/projects/timeline', icon: 'history', tier: 'L3', requiresAuth: true },
                { name: '荣誉中心', href: '/achievements', icon: 'emoji_events', tier: 'L3', requiresAuth: true },
            ]
        },
        {
            label: '智库教育',
            items: [
                { name: '专家文献', href: '/papers', icon: 'menu_book', tier: 'L2' },
                { name: '问答社区', href: '/community', icon: 'forum', tier: 'L2' },
                { name: '避坑指南', href: '/education/pitfalls', icon: 'error', tier: 'L2' },
            ]
        },
        {
            label: '标准与报表',
            items: [
                { name: '审计记录', href: '/audit', icon: 'verified_user', tier: 'L3', requiresAuth: true },
                {
                    name: '标准化工具',
                    icon: 'library_books',
                    tier: 'L3',
                    requiresAuth: true,
                    subItems: [
                        { name: '口径词典', href: '/tools/glossary' },
                        { name: '合同检测', href: '/tools/contract-check' },
                        { name: '参数假设', href: '/tools/assumptions' },
                    ]
                },
                {
                    name: '报告管理',
                    icon: 'description',
                    tier: 'L3',
                    requiresAuth: true,
                    subItems: [
                        { name: '生成报告', href: '/tools/report-export' },
                        { name: '模板管理', href: '/tools/report-templates' },
                    ]
                }
            ]
        },
        {
            label: '管理与开发',
            items: [
                { name: '企业空间', href: '/enterprise', icon: 'domain', tier: 'L4', requiresAuth: true },
                { name: '开发者中心', href: '/developer', icon: 'terminal', tier: 'L5', requiresAuth: true },
                { name: '会员订阅', href: '/pricing', icon: 'workspace_premium', tier: 'L4' },
            ]
        }
    ];

    // 状态管理子菜单展开
    const [expandedItems, setExpandedItems] = useState<string[]>(['标准化工具', '报告管理']);

    const toggleExpand = (name: string) => {
        setExpandedItems(prev =>
            prev.includes(name)
                ? prev.filter(i => i !== name)
                : [...prev, name]
        );
    };

    return (
        <>
            {/* 顶部移动端导航栏 - Only visible on mobile */}
            <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-background-dark border-b border-slate-200 dark:border-white/10 z-50 flex items-center px-4 lg:hidden">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-primary text-xl">bolt</span>
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">新能源智库</span>
                </div>

                {/* 右侧 */}
                <div className="flex items-center gap-2 ml-auto">
                    {/* 移动端菜单按钮 */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"
                    >
                        <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
                    </button>
                </div>
            </header>

            {/* Desktop Sidebar */}
            <aside className="fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-[#101922] border-r border-slate-200 dark:border-white/5 hidden lg:flex flex-col z-40 transition-transform duration-300">
                <div className="p-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-primary text-xl">bolt</span>
                            </div>
                            <h1 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">新能源智库</h1>
                        </div>
                        <p className="text-slate-500 dark:text-text-secondary text-xs font-normal">智能决策支持系统</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
                    {navGroups.map((group) => {
                        const visibleItems = group.items.filter(item => !item.requiresAuth || isLoggedIn);
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={group.label} className="flex flex-col gap-1">
                                <h3 className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                                    {group.label}
                                </h3>
                                <div className="flex flex-col gap-1">
                                    {(visibleItems as NavItem[]).map((item) => {
                                        const isAnySubActive = item.subItems?.some(sub => pathname === sub.href);
                                        const isActive = item.href ? (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) : isAnySubActive;
                                        const isExpanded = expandedItems.includes(item.name) || isAnySubActive;

                                        if (item.subItems) {
                                            return (
                                                <div key={item.name} className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => toggleExpand(item.name)}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group w-full text-left",
                                                            isExpanded ? "bg-slate-50 dark:bg-white/5" : "text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5"
                                                        )}
                                                    >
                                                        <span className="material-symbols-outlined text-slate-500 dark:text-white/70">
                                                            {item.icon}
                                                        </span>
                                                        <span className="text-sm font-medium">{item.name}</span>
                                                        <span className={cn(
                                                            "material-symbols-outlined ml-auto text-sm transition-transform",
                                                            isExpanded && "rotate-180"
                                                        )}>
                                                            expand_more
                                                        </span>
                                                    </button>
                                                    {isExpanded && (
                                                        <div className="flex flex-col gap-1 ml-9 border-l border-slate-100 dark:border-white/5 pl-2 my-1">
                                                            {item.subItems.map((sub) => {
                                                                const subActive = pathname === sub.href;
                                                                return (
                                                                    <Link
                                                                        key={sub.href}
                                                                        href={sub.href}
                                                                        className={cn(
                                                                            "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                                                                            subActive
                                                                                ? "text-primary bg-primary/5"
                                                                                : "text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"
                                                                        )}
                                                                    >
                                                                        {sub.name}
                                                                    </Link>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href!}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                                                    isActive
                                                        ? "bg-primary/10 text-primary border border-primary/20"
                                                        : "text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                                                )}
                                            >
                                                <span className={cn(
                                                    "material-symbols-outlined transition-colors",
                                                    isActive ? "text-primary fill-current" : "text-slate-500 dark:text-white/70 group-hover:text-primary"
                                                )}>
                                                    {item.icon}
                                                </span>
                                                <span className={cn("text-sm", isActive ? "font-bold" : "font-medium")}>{item.name}</span>
                                                {(item as any).badge && (
                                                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                                                        {(item as any).badge}
                                                    </span>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-200 dark:border-white/5">
                    {isLoggedIn ? (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-white/5">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-primary/20">
                                {session?.user?.name?.[0] || 'U'}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <p className="text-slate-900 dark:text-white text-xs font-bold truncate">{session?.user?.name || '用户'}</p>
                                <p className="text-slate-500 dark:text-white/50 text-[10px] truncate">专业版会员</p>
                            </div>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
                        >
                            <span className="material-symbols-outlined text-sm">login</span>
                            登录账户
                        </Link>
                    )}
                </div>
            </aside>

            {/* 移动端菜单 Drawer */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 top-14 bg-white dark:bg-background-dark z-40 lg:hidden p-4 overflow-y-auto">
                    <nav className="space-y-6">
                        {navGroups.map((group) => {
                            const visibleItems = group.items.filter(item => !item.requiresAuth || isLoggedIn);
                            if (visibleItems.length === 0) return null;

                            return (
                                <div key={group.label} className="flex flex-col gap-2">
                                    <h3 className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {group.label}
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                        {(visibleItems as NavItem[]).map((item) => {
                                            if (item.subItems) {
                                                return (
                                                    <div key={item.name} className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5">
                                                            <span className="material-symbols-outlined text-xl">{item.icon}</span>
                                                            {item.name}
                                                        </div>
                                                        <div className="flex flex-col gap-1 ml-9 pl-4 border-l border-slate-200 dark:border-white/10">
                                                            {item.subItems.map((sub) => (
                                                                <Link
                                                                    key={sub.href}
                                                                    href={sub.href}
                                                                    onClick={() => setMobileMenuOpen(false)}
                                                                    className={cn(
                                                                        "py-3 text-sm font-medium transition-colors",
                                                                        pathname === sub.href ? "text-primary" : "text-slate-500 dark:text-white/50"
                                                                    )}
                                                                >
                                                                    {sub.name}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const isActive = pathname === item.href;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href!}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                                        isActive
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-slate-600 dark:text-white/70 bg-slate-50 dark:bg-surface-dark"
                                                    )}
                                                >
                                                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                                                    {item.name}
                                                    {item.badge && (
                                                        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {!isLoggedIn && (
                            <Link
                                href="/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center justify-center gap-3 px-4 py-4 rounded-xl text-sm font-bold bg-primary text-white mt-4 shadow-lg shadow-primary/20"
                            >
                                <span className="material-symbols-outlined text-xl">login</span>
                                立即登录
                            </Link>
                        )}
                    </nav>
                </div>
            )}

            {/* 占位 - 仅移动端需要，桌面端 layout 会处理 margin */}
            <div className="h-0 lg:hidden" />
        </>
    );
}
