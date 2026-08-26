'use client';

import { useEffect, useState } from 'react';
import { API_BASE, extractList, fetchJson } from '../../../../lib/config';

type Skill = { id: string; name: string; description?: string; version?: string };

export default function SkillsWorkbenchPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    void fetchJson(`${API_BASE}/api/v1/ai/skills`, { credentials: 'include' })
      .then((payload) => {
        const rows = extractList(payload);
        if (!rows) throw new Error('Invalid skills response');
        setSkills(rows.map((row) => ({
          id: String(row.id ?? row.skill_id ?? ''),
          name: String(row.name ?? row.title ?? row.id ?? 'Unnamed skill'),
          description: row.description ? String(row.description) : undefined,
          version: row.version ? String(row.version) : undefined,
        })).filter((skill) => skill.id));
        setStatus('ready');
      })
      .catch(() => setStatus('unavailable'));
  }, []);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
      <div>
        <p className="text-sm text-slate-500">Registry-backed tools only</p>
        <h1 className="text-3xl font-bold text-slate-950">Advanced Energy Skills</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Review each skill’s version, assumptions and cited sources before using its output in an investment decision.</p>
      </div>
      {status === 'loading' && <p>Loading the verified skill registry…</p>}
      {status === 'unavailable' && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          The verified Skills registry is unavailable. No locally invented calculators are shown.
        </div>
      )}
      {status === 'ready' && skills.length === 0 && <p>No verified skills are currently published.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {skills.map((skill) => (
          <article key={skill.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">{skill.name}</h2>
              {skill.version && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">v{skill.version}</span>}
            </div>
            <p className="mt-2 text-sm text-slate-600">{skill.description ?? 'No registry description supplied.'}</p>
            <p className="mt-4 text-xs text-slate-400">Skill ID: {skill.id}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
