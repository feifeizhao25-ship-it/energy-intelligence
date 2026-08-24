'use client';
/**
 * EnergyIQ — Policies Page
 *
 * Policy and regulatory tracker fed by GET /api/v1/policies. When the API
 * is not configured or unreachable, an honest empty state is shown.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React from 'react';
import { Scale } from 'lucide-react';
import { Badge, Card } from '@energy-intelligence/ui-web';
import GlobalShell from '../GlobalShell';
import EmptyState from '../EmptyState';
import useApiList from '../../hooks/useApiList';

function levelBadge(value: unknown): { label: string; color: 'brand' | 'info' | 'neutral' } {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('federal')) return { label: 'Federal', color: 'brand' };
  if (text.includes('state')) return { label: 'State', color: 'info' };
  return { label: value ? String(value) : 'Policy', color: 'neutral' };
}

const PoliciesPage: React.FC = () => {
  const { state, rows, reload } = useApiList('/api/v1/policies');

  return (
    <GlobalShell title="Policies" breadcrumb={['EnergyIQ', 'Policies']}>
      <div className="max-w-[1100px] mx-auto space-y-6">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Policies</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Federal and state regulatory developments that affect clean-energy projects — IRA
            guidance, tax credit rules, permitting and market design.
          </p>
        </div>

        {state === 'loading' ? (
          <Card padding="lg">
            <div className="py-10 text-center text-[13px] text-[var(--text-tertiary)]">
              Loading policy feed…
            </div>
          </Card>
        ) : state === 'unavailable' ? (
          <EmptyState
            icon={<Scale size={22} />}
            title="Policy feed is not available"
            description="The policies service is not connected. When it is configured, IRA guidance, IRS notices and state regulatory dockets will be tracked here."
            actionLabel="Retry"
            onAction={reload}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Scale size={22} />}
            title="No policy updates yet"
            description="The policy feed returned no entries. New regulatory developments will appear here as they are published."
            actionLabel="Refresh"
            onAction={reload}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row, i) => {
              const level = levelBadge(row.level ?? row.jurisdiction);
              return (
                <Card key={String(row.id ?? i)} padding="md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {String(row.title ?? row.name ?? 'Untitled policy')}
                        </span>
                        <Badge color={level.color}>{level.label}</Badge>
                      </div>
                      {!!(row.summary ?? row.description) && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                          {String(row.summary ?? row.description)}
                        </p>
                      )}
                    </div>
                    {!!(row.updated_at ?? row.updated ?? row.date) && (
                      <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                        {String(row.updated_at ?? row.updated ?? row.date)}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </GlobalShell>
  );
};

export default PoliciesPage;
