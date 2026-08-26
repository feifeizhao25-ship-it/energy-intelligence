'use client';
/**
 * EnergyIQ — Interconnection Page
 *
 * - Static walkthrough of the US interconnection study process.
 * - Queue status pulled from the backend; when the API is not configured
 *   or returns nothing, an honest empty state is shown — never invented
 *   queue positions.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { PlugZap } from 'lucide-react';
import { Badge, Card } from '@energy-intelligence/ui-web';
import GlobalShell from '../components/GlobalShell';
import EmptyState from '../components/EmptyState';
import { API_BASE, extractList, fetchJson } from '../lib/config';

const STAGES = [
  {
    name: 'Interconnection request',
    detail:
      'File a request with the ISO/RTO or utility during a cluster window, with site control and a deposit.',
  },
  {
    name: 'Feasibility study',
    detail:
      'High-level screening of thermal and voltage impacts at the proposed point of interconnection.',
  },
  {
    name: 'System impact study',
    detail:
      'Detailed power-flow, stability and short-circuit analysis; identifies network upgrades and cost allocation.',
  },
  {
    name: 'Facilities study',
    detail:
      'Engineering and cost estimates for the interconnection facilities and required upgrades.',
  },
  {
    name: 'Interconnection agreement',
    detail:
      'Negotiate and execute the IA (LGIA/SGIA), post financial security and lock the construction schedule.',
  },
  {
    name: 'Construction & energization',
    detail:
      'Build, test and commission; synchronize and reach commercial operation (COD).',
  },
] as const;

type QueueState = 'loading' | 'ready' | 'unavailable';

const InterconnectionPage: React.FC = () => {
  const [state, setState] = useState<QueueState>('loading');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const payload = await fetchJson(`${API_BASE}/api/v1/interconnection/queue`);
      const list = extractList(payload);
      if (!list) throw new Error('unrecognized payload');
      setRows(list);
      setState('ready');
    } catch {
      setRows([]);
      setState('unavailable');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <GlobalShell title="Interconnection" breadcrumb={['EnergyIQ', 'Interconnection']}>
      <div className="max-w-[1100px] mx-auto space-y-6">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">
            Interconnection
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            From queue entry to energization — the study process every US project goes through,
            plus your projects' queue status.
          </p>
        </div>

        {/* ── Study process ── */}
        <Card title="The interconnection study process" padding="lg">
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STAGES.map((stage, i) => (
              <li
                key={stage.name}
                className="flex gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border-default)]"
              >
                <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-600)] text-[13px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">
                    {stage.name}
                  </div>
                  <div className="text-[12px] leading-relaxed text-[var(--text-secondary)] mt-0.5">
                    {stage.detail}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* ── Queue status ── */}
        <Card
          title={
            <span className="inline-flex items-center gap-2">
              <PlugZap size={15} className="text-[var(--color-brand-500)]" />
              Queue status
            </span>
          }
          padding="lg"
        >
          {state === 'loading' ? (
            <div className="py-10 text-center text-[13px] text-[var(--text-tertiary)]">
              Checking interconnection queue service…
            </div>
          ) : state === 'unavailable' ? (
            <EmptyState
              title="Queue data is not available"
              description="The interconnection queue service is not connected. Once your projects are linked to an ISO/RTO queue feed, their positions, study phases and upgrade cost allocations will appear here."
              actionLabel="Retry"
              onAction={() => void load()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No projects in the queue yet"
              description="None of your projects have an active interconnection request. File a request during a cluster window to enter the queue."
              actionLabel="Refresh"
              onAction={() => void load()}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border-default)]">
                    <th className="py-2 pr-4 font-medium">Project</th>
                    <th className="py-2 pr-4 font-medium">ISO / RTO</th>
                    <th className="py-2 pr-4 font-medium">Queue position</th>
                    <th className="py-2 pr-4 font-medium">Capacity</th>
                    <th className="py-2 font-medium">Study phase</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={String(row.id ?? i)}
                      className="border-b border-[var(--border-default)] last:border-0"
                    >
                      <td className="py-2.5 pr-4 text-[13px] font-medium text-[var(--text-primary)]">
                        {String(row.project ?? row.name ?? '—')}
                      </td>
                      <td className="py-2.5 pr-4 text-[13px] text-[var(--text-secondary)]">
                        {String(row.iso ?? row.rto ?? '—')}
                      </td>
                      <td className="py-2.5 pr-4 text-[13px] font-mono text-[var(--text-primary)]">
                        {String(row.position ?? row.queue_position ?? '—')}
                      </td>
                      <td className="py-2.5 pr-4 text-[13px] font-mono text-[var(--text-primary)]">
                        {row.capacity_mw != null ? `${row.capacity_mw} MW` : '—'}
                      </td>
                      <td className="py-2.5">
                        <Badge color="info">{String(row.phase ?? row.stage ?? '—')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </GlobalShell>
  );
};

export default InterconnectionPage;
