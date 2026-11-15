/**
 * 登录后的侧栏用户菜单（桌面底栏和移动菜单）都要能退出。
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('next-auth/react', () => ({
    signOut: jest.fn(async () => undefined),
    useSession: () => ({ data: { user: { name: '张三', plan: 'FREE' } } }),
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
jest.mock('@/contexts/StationContext', () => ({ useStation: () => ({ issues: [] }) }));
jest.mock('@/components/ui/ThemeToggle', () => ({ ThemeToggle: () => null }));

import Sidebar from './Sidebar';

describe('侧栏用户菜单', () => {
    it('登录后桌面侧栏有退出登录，移动菜单用同一用户菜单', () => {
        const html = renderToStaticMarkup(<Sidebar />);
        expect(html).toContain('退出登录');
        expect(html).toContain('用户菜单');
        expect(html).toContain('张三');
        expect(html).toContain('免费');
        const source = readFileSync(join(__dirname, 'Sidebar.tsx'), 'utf8');
        expect(source.match(/<UserAccountMenu/g)).toHaveLength(2);
        const drawer = source.slice(source.indexOf('data-testid="mobile-nav-drawer"'));
        expect(drawer.startsWith('data-testid="mobile-nav-drawer"')).toBe(true);
        expect(drawer).toContain('z-[60]');
        expect(drawer).toContain('top-[calc(3.5rem+env(safe-area-inset-top))]');
        expect(drawer).toContain('pb-[calc(6rem+env(safe-area-inset-bottom))]');
        expect(drawer).toContain('overflow-y-auto');
        expect(drawer).toContain('<UserAccountMenu');
    });
});
