'use client';

import { FormEvent, useState } from 'react';
import GlobalShell from '@/components/GlobalShell';
import { accessTokenFrom, authApi, userApi } from '@/lib/api';
import { userFromPayload } from '@/lib/auth/session-user';
import { useAuth } from '@/stores/auth-store';
import { TestLoginButton } from './test-login-button';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const tokens = await authApi.login(email, password);
      const token = accessTokenFrom(tokens);
      localStorage.setItem('auth_token', token);
      const profile = await userApi.me();
      const user = userFromPayload(profile);
      if (!user?.name) throw new Error('Sign-in failed. Please try again.');
      login(user, token);
      window.location.assign('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setPending(false);
    }
  }

  return (
    <GlobalShell title="Sign in" breadcrumb={['EnergyIQ', 'Sign in']}>
      <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-[var(--text-secondary)]">Use the email and password for your EnergyIQ account.</p>
        <label className="block text-sm font-semibold">Email
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Password
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded-lg bg-[var(--color-brand-600)] py-3 font-bold text-white disabled:opacity-50" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
        <TestLoginButton />
      </form>
    </GlobalShell>
  );
}
