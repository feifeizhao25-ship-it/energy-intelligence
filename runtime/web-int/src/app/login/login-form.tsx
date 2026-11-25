'use client';

import { FormEvent, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export function userFromPayload(body: unknown): { name: string; email: string } | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const data = record.data;
  const nested = data && typeof data === 'object' ? (data as Record<string, unknown>).user ?? data : null;
  const raw = (nested && typeof nested === 'object' ? nested : record) as Record<string, unknown>;
  if (typeof raw.name !== 'string' && typeof raw.email !== 'string') return null;
  if (raw.access_token && !raw.email && !raw.name) return null;
  return { name: String(raw.name || raw.email || ''), email: String(raw.email || '') };
}

export function accessTokenFrom(body: unknown): string {
  if (!body || typeof body !== 'object') throw new Error('Sign-in failed. Please try again.');
  const record = body as Record<string, unknown>;
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record;
  const token = data.access_token || data.token;
  if (typeof token !== 'string' || !token) throw new Error('Sign-in failed. Please try again.');
  return token;
}

async function postJson(path: string, payload: unknown, token?: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Market': 'global',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.detail === 'string' ? body.detail : 'Sign-in failed. Please try again.';
    throw new Error(message);
  }
  return body;
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const body = await postJson('/api/v1/auth/login', { email, password });
      const token = accessTokenFrom(body);
      localStorage.setItem('auth_token', token);
      const profile = await fetch(`${API_BASE}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}`, 'X-App-Market': 'global' },
      });
      const profileBody = await profile.json().catch(() => ({}));
      const user = userFromPayload(profileBody);
      if (!profile.ok || !user?.name) throw new Error('Sign-in failed. Please try again.');
      localStorage.setItem('auth_user_name', user.name);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label>Email
        <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>Password
        <input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="button" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <TestLoginButton />
    </form>
  );
}

export function TestLoginButton() {
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_TEST_LOGIN_ENABLED !== '1') return null;
  return (
    <button
      type="button"
      data-testid="ei-test-login-channel"
      className="button secondary"
      onClick={async () => {
        const body = await postJson('/api/v1/auth/test-login', { market: 'global', name: 'Test User' });
        const token = accessTokenFrom(body);
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user_name', 'Test User');
        window.location.href = '/';
      }}
    >
      Test sign-in
    </button>
  );
}
