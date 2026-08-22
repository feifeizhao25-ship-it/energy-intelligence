'use client';

import { useEffect, useState } from 'react';
import { API_BASE, fetchJson } from '../../../lib/config';

export default function AnalyticsPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetchJson(`${API_BASE}/api/v1/dashboard/metrics`, { credentials: 'include' })
      .then((value) => {
        setData(value as Record<string, unknown>);
        setStatus('ready');
      })
      .catch(() => setStatus('unavailable'));
  }, []);

  return (
    <main className="space-y-6 p-5 md:p-8">
      <div>
        <p className="text-sm text-slate-500">Verified portfolio telemetry</p>
        <h1 className="text-3xl font-bold text-slate-950">Analytics</h1>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        {status === 'loading' && <p>Loading verified analytics…</p>}
        {status === 'unavailable' && (
          <p className="text-slate-600">Analytics are unavailable because no verified telemetry was returned. No sample metrics are shown.</p>
        )}
        {status === 'ready' && data && (
          <pre className="overflow-auto whitespace-pre-wrap text-sm text-slate-700">{JSON.stringify(data, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}
