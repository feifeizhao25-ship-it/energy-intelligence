'use client';

/**
 * AppShell — application frame (TopBar + Sidebar + PageHeader) shared by the
 * CN and global frontends. Navigation is delegated via onNavigate so the
 * shell works with both the Pages and App routers.
 */

import React, { useState } from 'react';
import { cn } from './index';

export interface SidebarItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
}

export interface TopBarProps {
  market: 'cn' | 'global';
  onSearch?: () => void;
  notificationCount?: number;
  userName?: string;
  userAvatar?: string;
  onNavigate?: (href: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ market, onSearch, notificationCount = 0, userName, userAvatar, onNavigate }) => (
  <header className="h-14 flex items-center justify-between gap-3 px-3 sm:px-4 bg-[var(--bg-primary)] border-b border-[var(--border-default)] sticky top-0 z-[var(--z-sticky)]">
    {/* 左：Logo + 搜索 */}
    <div className="flex items-center gap-3 min-w-0">
      <button onClick={() => onNavigate?.('/dashboard')} className="flex items-center gap-2 cursor-pointer">
        <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-brand-500)] flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
        </div>
        <span className="text-[16px] font-semibold text-[var(--text-primary)] truncate">{market === 'cn' ? '新能源智库' : 'EnergyIQ'}</span>
      </button>
      {/* ⌘K 搜索 */}
      <button onClick={onSearch} className="hidden sm:flex items-center gap-2 w-[280px] h-9 px-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] text-[13px] hover:border-[var(--border-strong)] transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" strokeLinecap="round"/></svg>
        <span className="flex-1 text-left truncate">{market === 'cn' ? '搜索…' : 'Search…'}</span>
        <kbd className="text-[11px]">⌘K</kbd>
      </button>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {/* 通知铃铛 */}
      <button aria-label="notifications" className="relative w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {notificationCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[var(--color-danger)] text-white text-[10px] leading-4 text-center">{notificationCount}</span>
        )}
      </button>
      <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[var(--border-default)]">
        {userAvatar ? (
          <img src={userAvatar} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-brand-100)] text-[var(--color-brand-600)] flex items-center justify-center text-[13px] font-semibold">
            {(userName ?? 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="text-[13px] text-[var(--text-primary)]">{userName}</span>
      </div>
    </div>
  </header>
);

export interface SidebarProps {
  items: SidebarItem[];
  active?: string;
  collapsed: boolean;
  market: 'cn' | 'global';
  onToggle: () => void;
  onNavigate?: (href: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, active, collapsed, market, onToggle, onNavigate }) => (
  <nav className={cn(
    'flex flex-col border-r border-[var(--border-default)] bg-[var(--bg-primary)] transition-all',
    collapsed ? 'w-[56px]' : 'w-[220px]',
  )}>
    <div className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onNavigate?.(item.href ?? `/${item.key}`)}
          className={cn(
            'w-full flex items-center gap-2.5 h-9 px-2.5 rounded-[var(--radius-md)] text-[13px] transition-colors cursor-pointer',
            item.key === active
              ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-600)] font-medium'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]',
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          {!collapsed && <span className="truncate">{item.label}</span>}
        </button>
      ))}
    </div>
    <button
      onClick={onToggle}
      aria-label={collapsed ? 'expand sidebar' : 'collapse sidebar'}
      className="h-10 border-t border-[var(--border-default)] text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
    >
      {collapsed ? '»' : '«'}
    </button>
  </nav>
);

export interface PageHeaderProps {
  breadcrumb?: string[];
  title?: React.ReactNode;
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ breadcrumb, title, extra }) => (
  <div className="flex items-center justify-between gap-3 px-3 sm:px-6 h-12 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
    <div className="min-w-0">
      {breadcrumb && breadcrumb.length > 0 && (
        <div className="text-[11px] text-[var(--text-tertiary)] truncate">{breadcrumb.join(' / ')}</div>
      )}
      <h1 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{title}</h1>
    </div>
    {extra}
  </div>
);

export interface AppShellProps {
  market: 'cn' | 'global';
  sidebarItems: SidebarItem[];
  activeNav?: string;
  pageTitle?: React.ReactNode;
  breadcrumb?: string[];
  headerExtra?: React.ReactNode;
  inspector?: React.ReactNode;
  userName?: string;
  notificationCount?: number;
  onNavigate?: (href: string) => void;
  onSearch?: () => void;
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  market, sidebarItems, activeNav, pageTitle, breadcrumb, headerExtra, inspector, children, userName, notificationCount, onNavigate, onSearch,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex flex-col h-screen bg-[var(--bg-tertiary)]">
      <TopBar market={market} userName={userName} notificationCount={notificationCount} onNavigate={onNavigate} onSearch={onSearch} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar items={sidebarItems} active={activeNav} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onNavigate={onNavigate} market={market} />
        </div>
        <main className="flex-1 flex flex-col overflow-hidden">
          <PageHeader breadcrumb={breadcrumb} title={pageTitle} extra={headerExtra} />
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">{children}</div>
            {inspector && <aside className="hidden lg:block w-[280px] border-l border-[var(--border-default)] bg-[var(--bg-primary)] overflow-y-auto p-4 flex-shrink-0">{inspector}</aside>}
          </div>
        </main>
      </div>
    </div>
  );
};
