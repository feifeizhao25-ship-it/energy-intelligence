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

import React, { useState, useMemo } from 'react';
import { Button, Card, Badge, KPIRibbon, SegmentedControl, Progress } from '@energy-intelligence/ui-web';
import { cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../components/GlobalShell';
import DemoBadge from '../components/DemoBadge';
import PersonalizedSection from '../components/dashboard/PersonalizedSection';

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
  { label: 'Total Capacity', value: '2,847', unit: 'MW', trend: { value: 4.2, positive: true }, color: 'var(--color-brand-500)' },
  { label: 'Avg IRR', value: '14.6', unit: '%', trend: { value: 1.8, positive: true }, color: 'var(--color-success)' },
  { label: 'Projects', value: '38', unit: '', trend: { value: 2.7, positive: true }, color: 'var(--color-info)' },
  { label: 'CO₂ Avoided', value: '1.24', unit: 'M tons', trend: { value: 5.1, positive: true }, color: '#5FAE7A' },
];

const RECENT_PROJECTS: ProjectItem[] = [
  { id: 'p01', name: 'Mojave Sun Farm',     type: 'PV',      capacityMW: 250, irr: 16.2, status: 'Operating',   location: 'California, USA',   updated: '2h ago' },
  { id: 'p02', name: 'Brazos Wind Phase II', type: 'Wind',   capacityMW: 180, irr: 12.8, status: 'Construction', location: 'Texas, USA',        updated: '5h ago' },
  { id: 'p03', name: 'ERCOT BESS Hub',       type: 'Storage', capacityMW: 100, irr: 18.4, status: 'Operating',   location: 'Texas, USA',        updated: '1d ago' },
  { id: 'p04', name: 'Sonora Hybrid Park',   type: 'Hybrid',  capacityMW: 320, irr: 15.1, status: 'Development',  location: 'Sonora, Mexico',    updated: '3d ago' },
];

const MARKET_DATA: Record<string, MarketPrice> = {
  ERCOT: { iso: 'ERCOT', lmp: 38.50, change: 3.2,  ppa: 45.00 },
  CAISO: { iso: 'CAISO', lmp: 52.25, change: -1.8, ppa: 58.50 },
  PJM:   { iso: 'PJM',   lmp: 41.00, change: 0.9,  ppa: 48.00 },
  SPP:   { iso: 'SPP',   lmp: 29.75, change: 5.4,  ppa: 35.50 },
};

// ITC countdown — Inflation Reduction Act
const ITC_EXPIRY = new Date('2032-12-31');
const DAYS_REMAINING = Math.ceil((ITC_EXPIRY.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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

const MiniBarChart: React.FC = () => {
  const bars = [42, 55, 38, 67, 49, 72, 58, 63, 51, 78, 45, 69];
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const max = Math.max(...bars);
  return (
    <div className="flex items-end justify-between gap-1 h-24">
      {bars.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t-[2px] bg-[var(--color-brand-500)] opacity-80 hover:opacity-100 transition-opacity"
            style={{ height: `${(v / max) * 100}%` }}
          />
          <span className="text-[9px] text-[var(--text-tertiary)]">{months[i]}</span>
        </div>
      ))}
    </div>
  );
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
  const market = MARKET_DATA[activeISO];

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
        <PersonalizedSection />

        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-bold text-[var(--text-primary)]">Portfolio Overview</h1>
              <DemoBadge />
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Sample portfolio figures · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </header>

        {/* ── KPI Ribbon ── */}
        <KPIRibbon items={KPI_ITEMS} className="grid-cols-4" />

        {/* ── Main Grid: 2fr / 1fr ── */}
        <div className="grid grid-cols-3 gap-6">

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
              <div className="grid grid-cols-2 gap-6">
                {/* Monthly Generation */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">Monthly Generation</span>
                    <Badge color="brand">GWh</Badge>
                  </div>
                  <MiniBarChart />
                </div>
                {/* Key Metrics */}
                <div className="space-y-1">
                  <MiniLinePlaceholder label="Capacity Factor" value="28.4%" trend="↑ 2.1%" />
                  <MiniLinePlaceholder label="Availability" value="98.7%" trend="↑ 0.3%" />
                  <MiniLinePlaceholder label="Revenue (YTD)" value="$48.2M" trend="↑ 8.5%" />
                  <MiniLinePlaceholder label="DSCR" value="1.42x" trend="↑ 0.04" />
                  <MiniLinePlaceholder label="LCOE" value="$32.5/MWh" trend="↓ 1.2%" />
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
                        ${market.lmp.toFixed(2)}
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
                          ${market.ppa.toFixed(2)}
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

            {/* ── Incentive Tracker: ITC ── */}
            <Card title="Incentive Tracker" padding="md">
              <div className="space-y-4">
                {/* ITC Status */}
                <div className="p-3 rounded-[var(--radius-md)] bg-[#E6F7EF] border border-[#B7E6D0]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-[var(--color-success)]">
                      Federal ITC — 30% Active
                    </span>
                    <Badge color="success" dot>Active</Badge>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Investment Tax Credit under the Inflation Reduction Act (IRA). Applies to
                    qualifying solar, wind, and storage projects placed in service before 2033.
                  </p>
                </div>

                {/* IRA Countdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-[var(--text-secondary)]">IRA ITC Expiry</span>
                    <span className="text-[13px] font-mono font-semibold text-[var(--text-primary)]">
                      {DAYS_REMAINING.toLocaleString()} days
                    </span>
                  </div>
                  <Progress value={35} className="w-full" />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--text-tertiary)]">2022</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">Dec 31, 2032</span>
                  </div>
                </div>

                {/* Bonus Credits */}
                <div className="space-y-2 pt-2 border-t border-[var(--border-default)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-secondary)]">Domestic Content Bonus</span>
                    <Badge color="success">+10%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-secondary)]">Energy Community</span>
                    <Badge color="success">+10%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-secondary)]">Low-Income Bonus</span>
                    <Badge color="neutral">+10%</Badge>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── ESG Card ── */}
            <Card title="ESG Impact" padding="md">
              <div className="space-y-4">
                {/* CO₂ */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
                    <div className="text-[11px] text-[var(--text-tertiary)] mb-1">CO₂ Avoided</div>
                    <div className="text-[20px] font-bold font-mono" style={{ color: '#5FAE7A' }}>1.24M</div>
                    <div className="text-[11px] text-[var(--text-secondary)]">tons / year</div>
                  </div>
                  <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)]">
                    <div className="text-[11px] text-[var(--text-tertiary)] mb-1">MWh Generated</div>
                    <div className="text-[20px] font-bold font-mono" style={{ color: '#4FA8C9' }}>5,840</div>
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
                    <span className="text-[16px] font-bold font-mono" style={{ color: '#5FAE7A' }}>A+</span>
                  </div>
                  <Progress value={92} className="w-full" />
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
