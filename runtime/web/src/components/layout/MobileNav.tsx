'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Calculator, LayoutDashboard, Map, ScrollText } from 'lucide-react';

const ITEMS = [
    { href: '/dashboard', label: '总览', icon: LayoutDashboard },
    { href: '/map', label: '地图', icon: Map },
    { href: '/calculator', label: '测算', icon: Calculator },
    { href: '/policies', label: '政策', icon: ScrollText },
    { href: '/papers', label: '文献', icon: BookOpen },
];

export function MobileNav() {
    const pathname = usePathname() || '/';
    return (
        <nav className="ei-bottom-nav lg:hidden" aria-label="底部导航">
            {ITEMS.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                    <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
