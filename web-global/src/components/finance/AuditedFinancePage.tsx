'use client';

import { FormEvent, useState } from 'react';
import { API_BASE, fetchJson } from '../../lib/config';

type Kind = 'wind' | 'storage' | 'compare';

const configs = {
  wind: {
    title: 'Wind Finance',
    endpoint: '/api/v1/finance/wind',
    fields: {
      capacity_mw: 200,
      capex_per_kw: 1350,
      opex_per_kw_yr: 42,
      electricity_price: 0.065,
      wind_capacity_factor: 0.3,
      project_life: 20,
    },
  },
  storage: {
    title: 'Storage Finance',
    endpoint: '/api/v1/finance/storage',
    fields: {
      power_mw: 25,
      capacity_mwh: 50,
      cycles_per_year: 350,
      peak_price_per_mwh: 120,
      offpeak_price_per_mwh: 30,
      capex_per_kwh: 320,
    },
  },
  compare: {
    title: 'Solar Scenario Comparison',
    endpoint: '/api/v1/finance/solar',
    fields: {
      capacity_mw: 100,
      capex_per_w: 1.1,
      opex_per_kw_yr: 25,
      electricity_price: 0.06,
      ghi_annual: 1800,
      capacity_factor: 24,
      degradation_rate: 0.005,
      project_life: 25,
    },
  },
} satisfies Record<Kind, { title: string; endpoint: string; fields: Record<string, number> }>;

function labelFor(key: string) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AuditedFinancePage({ kind }: { kind: Kind }) {
  const config = configs[kind];
  const [values, setValues] = useState<Record<string, number>>(config.fields);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetchJson(`${API_BASE}${config.endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setResult(response as Record<string, unknown>);
    } catch {
      setError('The audited finance service is unavailable or the assumptions were rejected. No local estimate was generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
      <div>
        <p className="text-sm text-slate-500">Server-calculated · user assumptions</p>
        <h1 className="text-3xl font-bold text-slate-950">{config.title}</h1>
      </div>
      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2">
        {Object.entries(values).map(([key, value]) => (
          <label key={key} className="grid gap-1 text-sm font-medium text-slate-700">
            {labelFor(key)}
            <input
              required
              type="number"
              step="any"
              value={value}
              onChange={(event) => setValues((current) => ({ ...current, [key]: Number(event.target.value) }))}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        ))}
        <button disabled={loading} className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50 md:col-span-2">
          {loading ? 'Calculating…' : 'Calculate with audited model'}
        </button>
      </form>
      {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">{error}</div>}
      {result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-xl font-bold">Verified model response</h2>
          <pre className="overflow-auto whitespace-pre-wrap text-sm">{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
