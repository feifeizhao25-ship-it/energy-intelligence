'use client';
/**
 * EnergyIQ — Alerts Page
 *
 * Operational and market alerts fed by GET /api/v1/alerts. When the API is
 * not configured or unreachable, an honest empty state is shown.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React from 'react';
import { Bell } from 'lucide-react';
import { Badge, Card } from '@energy-intelligence/ui-web';
import GlobalShell from '../GlobalShell';
import EmptyState from '../EmptyState';
import useApiList from '../../hooks/useApiList';

function severityBadge(value: unknown): {
  label: string;
  color: 'danger' | 'warning' | 'info' | 'neutral';
} {
  const text = String(value ?? '').toLowerCase();
  if (text === 'critical' || text === 'high') return { label: 'Critical', color: 'danger' };
  if (text === 'warning' || text === 'medium') return { label: 'Warning', color: 'warning' };
  if (text === 'info' || text === 'low') return { label: 'Info', color: 'info' };
  return { label: value ? String(value) : 'Notice', color: 'neutral' };
}

const AlertsPage: React.FC = () => {
  const { state, rows, reload } = useApiList('/api/v1/alerts');

  return (
    <GlobalShell title="Alerts" breadcrumb={['EnergyIQ', 'Alerts']}>
      <div className="max-w-[1100px] mx-auto space-y-6">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Alerts</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Operational, market and regulatory alerts across your portfolio.
          </p>
        </div>

        {state === 'loading' ? (
          <Card padding="lg">
            <div className="py-10 text-center text-[13px] text-[var(--text-tertiary)]">
              Loading alerts…
            </div>
          </Card>
        ) : state === 'unavailable' ? (
          <EmptyState
            icon={<Bell size={22} />}
            title="Alerts are not available"
            description="The alerts service is not connected. When it is configured, portfolio events, price spikes and regulatory notices will show up here."
            actionLabel="Retry"
            onAction={reload}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Bell size={22} />}
            title="No active alerts"
            description="Nothing needs your attention right now. New alerts will appear here as they are raised."
            actionLabel="Refresh"
            onAction={reload}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row, i) => {
              const severity = severityBadge(row.severity);
              return (
                <Card key={String(row.id ?? i)} padding="md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge color={severity.color} dot>
                          {severity.label}
                        </Badge>
                        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {String(row.title ?? row.name ?? 'Alert')}
                        </span>
                      </div>
                      {!!(row.message ?? row.description) && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                          {String(row.message ?? row.description)}
                        </p>
                      )}
                    </div>
                    {!!(row.created_at ?? row.time ?? row.timestamp) && (
                      <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                        {String(row.created_at ?? row.time ?? row.timestamp)}
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

export default AlertsPage;
