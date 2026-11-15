'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Calculator, LayoutDashboard, Map, ScrollText } from 'lucide-react';
import { isTextEntryElement } from '@/lib/layout/text-entry-focus';

const ITEMS = [
    { href: '/dashboard', label: '总览', icon: LayoutDashboard },
    { href: '/map', label: '地图', icon: Map },
    { href: '/calculator', label: '测算', icon: Calculator },
    { href: '/policies', label: '政策', icon: ScrollText },
    { href: '/papers', label: '文献', icon: BookOpen },
];

export function MobileNav() {
    const pathname = usePathname() || '/';
    const [keyboard, setKeyboard] = useState(false);

    useEffect(() => {
        const sync = () => setKeyboard(isTextEntryElement(document.activeElement));
        const onFocusOut = () => window.setTimeout(sync, 0);
        document.addEventListener('focusin', sync);
        document.addEventListener('focusout', onFocusOut);
        // 键盘弹起会改 visualViewport。再对一下焦点，避免只靠 resize 把底栏藏在缩放里。
        window.visualViewport?.addEventListener('resize', sync);
        return () => {
            document.removeEventListener('focusin', sync);
            document.removeEventListener('focusout', onFocusOut);
            window.visualViewport?.removeEventListener('resize', sync);
        };
    }, []);

    return (
        <nav className={`ei-bottom-nav lg:hidden${keyboard ? ' is-hidden-for-keyboard' : ''}`} aria-label="底部导航">
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
