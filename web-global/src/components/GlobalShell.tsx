'use client';

/**
 * GlobalShell — shared application frame for the international edition.
 *
 * Information architecture follows what international users actually
 * work with (tax incentives, interconnection queues, market/policy
 * intelligence) — it is not a translation of the CN navigation
 * (grid / revenue / O&M).
 */

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Landmark,
  PlugZap,
  FileText,
  Scale,
  Bell,
  Sparkles,
  Settings,
  FolderKanban,
  CreditCard,
} from 'lucide-react';
import { AppShell } from '@energy-intelligence/ui-web';
import type { SidebarItem } from '@energy-intelligence/ui-web';

const ICON_SIZE = 16;

const PRIMARY_NAV: SidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: <LayoutDashboard size={ICON_SIZE} /> },
  { key: 'incentives', label: 'Incentives (ITC)', href: '/incentives', icon: <Landmark size={ICON_SIZE} /> },
  { key: 'interconnection', label: 'Interconnection', href: '/interconnection', icon: <PlugZap size={ICON_SIZE} /> },
  { key: 'reports', label: 'Reports', href: '/reports', icon: <FileText size={ICON_SIZE} /> },
  { key: 'policies', label: 'Policies', href: '/policies', icon: <Scale size={ICON_SIZE} /> },
  { key: 'alerts', label: 'Alerts', href: '/alerts', icon: <Bell size={ICON_SIZE} /> },
  { key: 'ai', label: 'AI Analyst', href: '/ai', icon: <Sparkles size={ICON_SIZE} /> },
  { key: 'settings', label: 'Settings', href: '/settings', icon: <Settings size={ICON_SIZE} /> },
];

const WORKSPACE_NAV: SidebarItem[] = [
  { key: 'projects', label: 'Projects', href: '/projects', icon: <FolderKanban size={ICON_SIZE} /> },
  { key: 'billing', label: 'Billing', href: '/billing', icon: <CreditCard size={ICON_SIZE} /> },
];

const NAV_ITEMS = [...PRIMARY_NAV, ...WORKSPACE_NAV];

function resolveActiveKey(pathname: string | null): string {
  const segment = (pathname ?? '/').replace(/\/+$/, '').split('/')[1] ?? '';
  if (!segment) return 'dashboard';
  const match = NAV_ITEMS.find((item) => item.key === segment);
  return match ? match.key : 'dashboard';
}

export interface GlobalShellProps {
  activeNav?: string;
  title?: React.ReactNode;
  breadcrumb?: string[];
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}

export const GlobalShell: React.FC<GlobalShellProps> = ({
  activeNav,
  title,
  breadcrumb,
  headerExtra,
  children,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const active = activeNav ?? resolveActiveKey(pathname);

  const handleNavigate = (href: string) => {
    // The TopBar logo targets '/dashboard'; the dashboard lives at '/'.
    router.push(href === '/dashboard' ? '/' : href);
  };

  return (
    <AppShell
      market="global"
      sidebarItems={NAV_ITEMS}
      activeNav={active}
      pageTitle={title}
      breadcrumb={breadcrumb}
      headerExtra={headerExtra}
      userName="Analyst"
      onNavigate={handleNavigate}
    >
      {children}
    </AppShell>
  );
};

export default GlobalShell;
