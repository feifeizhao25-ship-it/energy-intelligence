'use client';

import { signIn } from 'next-auth/react';

/** 正式构建里这段按钮会被编译掉。见 test-login.test.ts。 */
export function TestLoginButton({ callbackUrl = '/dashboard' }: { callbackUrl?: string }) {
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_TEST_LOGIN_ENABLED !== '1') {
        return null;
    }
    return (
        <button
            type="button"
            data-testid="ei-test-login-channel"
            className="mt-4 w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-500"
            onClick={() => signIn('test', { redirect: true, callbackUrl })}
        >
            测试登录
        </button>
    );
}
