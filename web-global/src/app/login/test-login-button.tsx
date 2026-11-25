'use client';

import { accessTokenFrom, userApi } from '@/lib/api';
import { userFromPayload } from '@/lib/auth/session-user';
import { useAuth } from '@/stores/auth-store';

/** 正式构建里这段按钮会被编译掉。 */
export function TestLoginButton() {
  const { login } = useAuth();
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_TEST_LOGIN_ENABLED !== '1') return null;
  return (
    <button
      type="button"
      data-testid="ei-test-login-channel"
      className="w-full rounded-lg border border-dashed py-2 text-sm"
      onClick={async () => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/test-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Market': 'global' },
          body: JSON.stringify({ market: 'global', name: 'Test User' }),
        });
        const body = await response.json();
        const token = accessTokenFrom(body);
        localStorage.setItem('auth_token', token);
        const profile = await userApi.me();
        const user = userFromPayload(profile);
        if (!user) return;
        login(user, token);
        window.location.assign('/');
      }}
    >
      Test sign-in
    </button>
  );
}
