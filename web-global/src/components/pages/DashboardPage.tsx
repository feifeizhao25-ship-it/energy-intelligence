'use client';
/**
 * EnergyIQ — International Dashboard Page
 *
 * Distinct information architecture from CN version:
 * - KPI Ribbon: Total Capacity | Avg IRR | Projects | CO₂ Avoided
 * - Left column: Recent Projects + Performance Overview
 * - Right column: Market (PPA/LMP) + Incentive (ITC) + ESG
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button, Card, Badge, KPIRibbon, SegmentedControl, Progress } from '@energy-intelligence/ui-web';
import { cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../GlobalShell';
import conflict from '../../lib/policy/us-48e-45y-conflict.json';

// ── Types ──────────────────────────────────────────────

interface ProjectItem {
  id: string;
  name: string;
  type: 'PV' | 'Wind' | 'Storage' | 'Hybrid';
  capacityMW: number;
  irr: number;
  status: 'Operating' | 'Construction' | 'Development';
  location: string;
  updated: string;
}

interface MarketPrice {
  iso: string;
  lmp: number;        // $/MWh
  change: number;     // % change
  ppa: number;        // $/MWh PPA price
}

// ── Mock Data ──────────────────────────────────────────

const KPI_ITEMS = [
  { label: 'Total Capacity', value: '—', unit: 'MW', trend: { value: 4.2, positive: true }, color: 'var(--color-brand-500)' },
  { label: 'Avg IRR', value: '—', unit: '%', trend: { value: 1.8, positive: true }, color: 'var(--color-success)' },
  { label: 'Projects', value: '0', unit: '', trend: { value: 2.7, positive: true }, color: 'var(--color-info)' },
  { label: 'CO₂ Avoided', value: '—', unit: 'M tons', trend: { value: 5.1, positive: true }, color: '#146c3e' },
];

const RECENT_PROJECTS: ProjectItem[] = [];

const MARKET_DATA: Record<string, MarketPrice> = {
  ERCOT: { iso: 'ERCOT', lmp: 38.50, change: 3.2,  ppa: 45.00 },
  CAISO: { iso: 'CAISO', lmp: 52.25, change: -1.8, ppa: 58.50 },
  PJM:   { iso: 'PJM',   lmp: 41.00, change: 0.9,  ppa: 48.00 },
  SPP:   { iso: 'SPP',   lmp: 29.75, change: 5.4,  ppa: 35.50 },
};

// ── Sub-components ─────────────────────────────────────

const ProjectTypeDot: React.FC<{ type: ProjectItem['type'] }> = ({ type }) => {
  const colors: Record<ProjectItem['type'], string> = {
    PV: '#F2A93B', Wind: '#4FA8C9', Storage: '#7B5EA8', Hybrid: '#5FAE7A',
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[type] }} />
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{type}</span>
    </span>
  );
};

const StatusBadge: React.FC<{ status: ProjectItem['status'] }> = ({ status }) => {
  const map: Record<ProjectItem['status'], { color: 'success' | 'warning' | 'info'; dot?: boolean }> = {
    Operating:   { color: 'success', dot: true },
    Construction:{ color: 'warning', dot: true },
    Development: { color: 'info',    dot: true },
  };
  const cfg = map[status];
  return <Badge color={cfg.color} dot>{status}</Badge>;
};

const MiniLinePlaceholder: React.FC<{ label: string; value: string; trend: string }> = ({ label, value, trend }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <div className="text-[12px] text-[var(--text-secondary)]">{label}</div>
      <div className="text-[18px] font-semibold font-mono text-[var(--text-primary)]">{value}</div>
    </div>
    <div className="text-[12px] text-[var(--color-success)]">{trend}</div>
  </div>
);

// ── Main Page ──────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const [activeISO, setActiveISO] = useState<string>('ERCOT');
  const [todayLabel, setTodayLabel] = useState('');
  const market = MARKET_DATA[activeISO];

  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
  }, []);

  const projectRows = useMemo(() => RECENT_PROJECTS, []);

  return (
    <GlobalShell
      title="Dashboard"
      breadcrumb={['EnergyIQ', 'Dashboard']}
      headerExtra={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<span>⬇</span>}>Export</Button>
          <Button variant="primary" size="sm" icon={<span>＋</span>}>New Project</Button>
        </div>
      }
    >
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ── Personalized layout (from /api/v1/personalization/daily-layout) ── */}
        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-bold text-[var(--text-primary)]">Portfolio Overview</h1>
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              No sample portfolio is shown.{todayLabel ? ` ${todayLabel}` : ''}
            </p>
          </div>
        </header>

        {/* ── KPI Ribbon ── */}
        <KPIRibbon items={KPI_ITEMS} className="grid-cols-2 md:grid-cols-4" />

        {/* ── Main Grid: 2fr / 1fr ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ═══ LEFT COLUMN (2fr) ═══ */}
          <div className="col-span-2 space-y-6">

            {/* ── Recent Projects ── */}
            <Card
              title="Recent Projects"
              extra={
                <Button variant="ghost" size="sm" iconRight={<span>→</span>}>
                  View All
                </Button>
              }
              padding="md"
            >
              <div className="space-y-3">
                {projectRows.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-[var(--radius-md)] border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-secondary)] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium text-[var(--text-primary)]">{p.name}</span>
                        <span className="text-[12px] text-[var(--text-tertiary)]">{p.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[12px] text-[var(--text-tertiary)]">Capacity</div>
                        <div className="text-[14px] font-mono font-medium text-[var(--text-primary)]">{p.capacityMW} MW</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] text-[var(--text-tertiary)]">IRR</div>
                        <div className={cn(
                          'text-[14px] font-mono font-medium',
                          p.irr >= 15 ? 'text-[var(--color-success)]' : 'text-[var(--text-primary)]'
                        )}>
                          {p.irr.toFixed(1)}%
                        </div>
                      </div>
                      <div className="w-20"><ProjectTypeDot type={p.type} /></div>
                      <div className="w-28"><StatusBadge status={p.status} /></div>
                      <span className="text-[11px] text-[var(--text-tertiary)] w-16 text-right">{p.updated}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Performance Overview ── */}
            <Card title="Performance Overview" padding="lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Monthly Generation */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">Monthly Generation</span>
                    <Badge color="brand">GWh</Badge>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">Monthly generation appears after a project is connected.</p>
                </div>
                {/* Key Metrics */}
                <div className="space-y-1">
                  <MiniLinePlaceholder label="Capacity Factor" value="—" trend="Not connected" />
                  <MiniLinePlaceholder label="Availability" value="—" trend="Not connected" />
                  <MiniLinePlaceholder label="Revenue (YTD)" value="—" trend="Not connected" />
                  <MiniLinePlaceholder label="DSCR" value="—" trend="Not connected" />
                  <MiniLinePlaceholder label="LCOE" value="—" trend="Not connected" />
                </div>
              </div>
            </Card>
          </div>

          {/* ═══ RIGHT COLUMN (1fr) ═══ */}
          <div className="col-span-1 space-y-6">

            {/* ── Market Card: PPA + LMP ── */}
            <Card
              title="Market Prices"
              extra={
                <SegmentedControl
                  options={[
                    { label: 'ERCOT', value: 'ERCOT' },
                    { label: 'CAISO', value: 'CAISO' },
                    { label: 'PJM',   value: 'PJM'   },
                    { label: 'SPP',   value: 'SPP'   },
                  ]}
                  value={activeISO}
                  onChange={setActiveISO}
                />
              }
            >
              <div className="space-y-4">
                {/* LMP */}
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[12px] text-[var(--text-secondary)] mb-1">LMP (Real-Time)</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[28px] font-bold font-mono text-[var(--text-primary)]">
                        —
                      </span>
                      <span className="text-[13px] text-[var(--text-tertiary)]">/MWh</span>
                    </div>
                  </div>
                  <div className={cn(
                    'flex items-center gap-1 text-[13px] font-medium px-2 py-1 rounded-[var(--radius-sm)]',
                    market.change >= 0
                      ? 'text-[var(--color-success)] bg-[#E6F7EF]'
                      : 'text-[var(--color-danger)] bg-[#FCE8E8]'
                  )}>
                    {market.change >= 0 ? '↑' : '↓'} {Math.abs(market.change)}%
                  </div>
                </div>

                {/* PPA */}
                <div className="pt-3 border-t border-[var(--border-default)]">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[12px] text-[var(--text-secondary)] mb-1">PPA Price</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[22px] font-semibold font-mono text-[var(--text-primary)]">
                          —
                        </span>
                        <span className="text-[12px] text-[var(--text-tertiary)]">/MWh</span>
                      </div>
                    </div>
                    <Badge color="info">Solar PPA</Badge>
                  </div>
                </div>

                {/* Sparkline placeholder */}
                <div className="pt-2">
                  <div className="flex items-end gap-0.5 h-10">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const h = 30 + Math.sin(i * 0.5) * 20 + Math.random() * 15;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-[var(--color-brand-400)] rounded-[1px] opacity-60"
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--text-tertiary)]">24h</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">Now</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Incentive Tracker: sources, no winner ── */}
            <Card title="Incentive Tracker" padding="md">
              <div className="space-y-3" data-testid="incentive-tracker-conflict">
                <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {conflict.instruction}{' '}
                  {conflict.resolution === null ? 'No source is selected.' : ''}{' '}
                  This is not investment advice.
                </p>
                {conflict.sources.map((source) => (
                  <article
                    key={source.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-2.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {source.role}
                      </h3>
                      <span className="text-[11px] text-[var(--text-tertiary)]">{source.date_label}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                      {source.statement}
                    </p>
                  </article>
                ))}
                <Link
                  href="/incentives"
                  className="inline-block text-[12px] text-[var(--color-brand-600)]"
                >
                  Open the full §48E / §45Y sources
                </Link>
              </div>
            </Card>

            {/* ── ESG Card ── */}
            <Card title="ESG Impact" padding="md">
              <div className="space-y-4">
                {/* CO₂ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
                    <div className="text-[11px] text-[var(--text-tertiary)] mb-1">CO₂ Avoided</div>
                    <div className="text-[20px] font-bold font-mono" style={{ color: '#146c3e' }}>—</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">tons / year</div>
                  </div>
                  <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
                    <div className="text-[11px] text-[var(--text-tertiary)] mb-1">MWh Generated</div>
                    <div className="text-[20px] font-bold font-mono" style={{ color: '#18658f' }}>—</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">GWh YTD</div>
                  </div>
                </div>

                {/* Equivalents */}
                <div className="pt-3 border-t border-[var(--border-default)]">
                  <div className="text-[12px] font-medium text-[var(--text-primary)] mb-2">
                    Equivalent to:
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#5FAE7A' }} />
                      269,000 cars taken off the road
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4FA8C9' }} />
                      21.8M trees planted equivalent
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F2A93B' }} />
                      1.5M households powered
                    </div>
                  </div>
                </div>

                {/* ESG Score */}
                <div className="pt-3 border-t border-[var(--border-default)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">ESG Score</span>
                    <span className="text-[16px] font-bold font-mono" style={{ color: '#146c3e' }}>—</span>
                  </div>
                  <Progress value={0} label="ESG Score" className="w-full" />
                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </GlobalShell>
  );
};

export default DashboardPage;
