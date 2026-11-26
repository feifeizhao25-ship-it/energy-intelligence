'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [focus, setFocus] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setPending(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Market': 'global' },
        body: JSON.stringify({
          name,
          email,
          password,
          market: 'global',
          data_transfer_consent: true,
          ...(role ? { role } : {}),
          ...(focus ? { tech_focus: [focus] } : {}),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setMessage('Please sign in. A 401 is not a disconnected service.');
        return;
      }
      if (response.status === 404) {
        setMessage('The registration address was not found (404). That is not the same as the service being offline.');
        return;
      }
      if (!response.ok) {
        const detail = typeof body?.detail === 'string' ? body.detail : 'Registration did not complete.';
        setMessage(detail);
        return;
      }
      setMessage(role || focus
        ? 'Account created with the role and focus you chose.'
        : 'Account created. No role or technology focus was assigned.');
    } catch {
      setMessage('The account service did not respond. Retry when the network is available.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">Create an account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Role and technology focus are optional. Leave them on “Choose later” and nothing is assumed.
      </p>
      {!role && !focus ? (
        <p role="status" className="mt-3 text-sm">No role or technology focus has been chosen. None is assumed.</p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm">Name
          <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">Email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">Password
          <input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="block text-sm">Role
          <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded border px-3 py-2">
            <option value="">Choose later</option>
            <option value="investor">Investor</option>
            <option value="operations">Operations</option>
            <option value="developer">Developer</option>
            <option value="analyst">Analyst</option>
          </select>
        </label>
        <label className="block text-sm">Technology focus
          <select value={focus} onChange={(event) => setFocus(event.target.value)} className="mt-1 w-full rounded border px-3 py-2">
            <option value="">Choose later</option>
            <option value="solar_pv">Solar PV</option>
            <option value="wind">Wind</option>
            <option value="storage">Storage</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
          <span>I agree to transfer the account data needed to create this international account.</span>
        </label>
        {message ? <p role="status">{message}</p> : null}
        <button type="submit" disabled={pending || !consent} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm"><Link href="/">Back to the workspace</Link></p>
    </main>
  );
}
