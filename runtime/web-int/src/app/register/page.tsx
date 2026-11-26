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
      if (response.status === 401) {
        setMessage('Please sign in. A 401 is not a disconnected service.');
        return;
      }
      if (response.status === 404) {
        setMessage('The registration address was not found (404). That is not the same as the service being offline.');
        return;
      }
      if (!response.ok) {
        setMessage('Registration did not complete.');
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
    <main className="shell">
      <h1>Create an account</h1>
      <p>Role and technology focus are optional. Leave them on Choose later and nothing is assumed.</p>
      {!role && !focus ? <p role="status">No role or technology focus has been chosen. None is assumed.</p> : null}
      <form onSubmit={onSubmit} className="stack">
        <label>Name<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Role
          <select aria-label="Role" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Choose later</option>
            <option value="investor">Investor</option>
            <option value="operations">Operations</option>
            <option value="developer">Developer</option>
            <option value="analyst">Analyst</option>
          </select>
        </label>
        <label>Technology focus
          <select aria-label="Technology focus" value={focus} onChange={(event) => setFocus(event.target.value)}>
            <option value="">Choose later</option>
            <option value="solar_pv">Solar PV</option>
            <option value="wind">Wind</option>
            <option value="storage">Storage</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /> I agree to transfer the account data needed to create this international account.</label>
        {message ? <p role="status">{message}</p> : null}
        <button className="button" type="submit" disabled={pending || !consent}>{pending ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p><Link href="/">Back to the workspace</Link></p>
    </main>
  );
}
