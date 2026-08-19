'use client';
/**
 * EnergyIQ — Reports Page
 *
 * - Report list fed by GET /api/v1/reports; honest empty state when the
 *   service is not connected or nothing has been generated yet.
 * - Generation entry posts to /api/v1/reports/generate; failures are
 *   surfaced as an inline error, never as a fabricated report.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { Badge, Button, Card, SegmentedControl } from '@energy-intelligence/ui-web';
import GlobalShell from '../components/GlobalShell';
import EmptyState from '../components/EmptyState';
import useApiList from '../hooks/useApiList';
import { API_BASE, fetchJson } from '../lib/config';

const REPORT_TYPES = [
  { label: 'Feasibility', value: 'feasibility' },
  { label: 'Market Outlook', value: 'market-outlook' },
  { label: 'Portfolio Performance', value: 'portfolio-performance' },
  { label: 'ESG Impact', value: 'esg-impact' },
];

const FORMATS = [
  { label: 'PDF', value: 'pdf' },
  { label: 'PPTX', value: 'pptx' },
];

const ReportsPage: React.FC = () => {
  const { state, rows, reload } = useApiList('/api/v1/reports');
  const [type, setType] = useState('feasibility');
  const [format, setFormat] = useState('pdf');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const generate = async () => {
    setSubmitting(true);
    setNotice(null);
    try {
      await fetchJson(`${API_BASE}/api/v1/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, format }),
      });
      setNotice({
        kind: 'success',
        text: 'Report request accepted. It will appear in the list once generation completes.',
      });
      reload();
    } catch {
      setNotice({
        kind: 'error',
        text: 'The report service could not be reached. No report was generated — please try again later.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GlobalShell
      title="Reports"
      breadcrumb={['EnergyIQ', 'Reports']}
      headerExtra={
        <Button variant="primary" size="sm" onClick={generate} disabled={submitting}>
          {submitting ? 'Requesting…' : 'Generate report'}
        </Button>
      }
    >
      <div className="max-w-[1100px] mx-auto space-y-6">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Reports</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Generate investor-ready feasibility, market and ESG reports, and find everything you
            have generated before.
          </p>
        </div>

        {/* ── Generation entry ── */}
        <Card title="Generate a report" padding="lg">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Report type
              </div>
              <SegmentedControl options={REPORT_TYPES} value={type} onChange={setType} />
            </div>
            <div>
              <div className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Format
              </div>
              <SegmentedControl options={FORMATS} value={format} onChange={setFormat} />
            </div>
            <Button variant="primary" size="md" onClick={generate} disabled={submitting}>
              {submitting ? 'Requesting…' : 'Generate'}
            </Button>
          </div>
          {notice && (
            <p
              className={
                notice.kind === 'success'
                  ? 'mt-3 text-[13px] text-[var(--color-success)]'
                  : 'mt-3 text-[13px] text-[var(--color-danger)]'
              }
            >
              {notice.text}
            </p>
          )}
        </Card>

        {/* ── Report list ── */}
        {state === 'loading' ? (
          <Card padding="lg">
            <div className="py-10 text-center text-[13px] text-[var(--text-tertiary)]">
              Loading reports…
            </div>
          </Card>
        ) : state === 'unavailable' ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Report service is not available"
            description="The reports backend is not connected. When it is configured, every report you generate will be listed here with its status and download link."
            actionLabel="Retry"
            onAction={reload}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="No reports yet"
            description="You have not generated any reports. Pick a report type above and generate your first one."
            actionLabel="Refresh"
            onAction={reload}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row, i) => (
              <Card key={String(row.id ?? i)} padding="md">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                      {String(row.name ?? row.title ?? row.type ?? 'Report')}
                    </div>
                    <div className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                      {String(row.created_at ?? row.createdAt ?? '')}
                    </div>
                  </div>
                  <Badge
                    color={
                      String(row.status).toLowerCase() === 'completed' ? 'success' : 'neutral'
                    }
                    dot
                  >
                    {String(row.status ?? 'unknown')}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </GlobalShell>
  );
};

export default ReportsPage;
