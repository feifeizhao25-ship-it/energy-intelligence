/**
 * 用户菜单需提供退出登录，并走现有 next-auth signOut 清会话。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const signOut = jest.fn(async () => undefined);
jest.mock('next-auth/react', () => ({
    signOut: (...args: unknown[]) => signOut(...args),
}));

import { clearLoginSession, UserAccountMenu } from './UserAccountMenu';

describe('用户菜单退出登录', () => {
    beforeEach(() => { signOut.mockClear(); });

    it('菜单里有退出登录，并调用 signOut 清会话', async () => {
        const html = renderToStaticMarkup(<UserAccountMenu name="张三" planLabel="免费" />);
        expect(html).toContain('aria-label="用户菜单"');
        expect(html).toContain('role="menuitem"');
        expect(html).toContain('退出登录');
        expect(html).toContain('张三');
        await clearLoginSession();
        expect(signOut).toHaveBeenCalledTimes(1);
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    });
});
