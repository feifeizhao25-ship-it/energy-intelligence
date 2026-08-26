'use client';
/**
 * EnergyIQ — International Project List Page
 *
 * Features:
 * - Search + Filter bar (Type: All/PV/Wind/Storage/Hybrid + Status)
 * - Table view with columns: Name | Type | Capacity(MW) | IRR | LCOE | Status | Updated
 * - Card view toggle
 * - "New Project" primary button
 * - Pagination
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useState, useMemo } from 'react';
import {
  Button, Card, Badge, Pagination, SegmentedControl, SearchBox,
} from '@energy-intelligence/ui-web';
import { cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../components/GlobalShell';

// ── Types ──────────────────────────────────────────────

type ProjectType = 'PV' | 'Wind' | 'Storage' | 'Hybrid';
type ProjectStatus = 'Operating' | 'Construction' | 'Development' | 'Permitting';

interface IntlProject {
  id: string;
  name: string;
  type: ProjectType;
  capacityMW: number;
  irr: number;
  lcoe: number;        // $/MWh
  status: ProjectStatus;
  location: string;
  updated: string;
}

// ── Mock Data ──────────────────────────────────────────

const ALL_PROJECTS: IntlProject[] = [
  { id: 'p01', name: 'Mojave Sun Farm',        type: 'PV',      capacityMW: 250, irr: 16.2, lcoe: 28.5,  status: 'Operating',    location: 'California, USA',   updated: '2h ago'  },
  { id: 'p02', name: 'Brazos Wind Phase II',   type: 'Wind',    capacityMW: 180, irr: 12.8, lcoe: 34.0,  status: 'Construction',  location: 'Texas, USA',        updated: '5h ago'  },
  { id: 'p03', name: 'ERCOT BESS Hub',         type: 'Storage', capacityMW: 100, irr: 18.4, lcoe: 22.0,  status: 'Operating',     location: 'Texas, USA',        updated: '1d ago'  },
  { id: 'p04', name: 'Sonora Hybrid Park',     type: 'Hybrid',  capacityMW: 320, irr: 15.1, lcoe: 31.2,  status: 'Development',   location: 'Sonora, Mexico',    updated: '3d ago'  },
  { id: 'p05', name: 'Imperial Valley Solar',   type: 'PV',     capacityMW: 200, irr: 14.8, lcoe: 30.1,  status: 'Operating',     location: 'California, USA',   updated: '1d ago'  },
  { id: 'p06', name: 'Panhandle Wind III',      type: 'Wind',   capacityMW: 150, irr: 13.5, lcoe: 33.5,  status: 'Permitting',    location: 'Texas, USA',        updated: '4d ago'  },
  { id: 'p07', name: 'Cascadia Storage Bank',   type: 'Storage',capacityMW: 80,  irr: 17.2, lcoe: 24.5,  status: 'Construction',  location: 'Oregon, USA',       updated: '6h ago'  },
  { id: 'p08', name: 'High Desert Solar',       type: 'PV',     capacityMW: 300, irr: 15.9, lcoe: 27.8,  status: 'Development',   location: 'Nevada, USA',       updated: '2d ago'  },
  { id: 'p09', name: 'Great Plains Hybrid',     type: 'Hybrid', capacityMW: 220, irr: 14.3, lcoe: 32.0,  status: 'Operating',     location: 'Kansas, USA',       updated: '12h ago' },
  { id: 'p10', name: 'Lone Star BESS',          type: 'Storage',capacityMW: 120, irr: 19.1, lcoe: 21.5,  status: 'Construction',  location: 'Texas, USA',        updated: '8h ago'  },
  { id: 'p11', name: 'Golden West Wind',        type: 'Wind',   capacityMW: 200, irr: 11.9, lcoe: 36.2,  status: 'Development',   location: 'Colorado, USA',     updated: '5d ago'  },
  { id: 'p12', name: 'Silver State Solar',      type: 'PV',     capacityMW: 175, irr: 16.5, lcoe: 26.9,  status: 'Operating',     location: 'Nevada, USA',       updated: '3h ago'  },
];

const TYPE_COLORS: Record<ProjectType, string> = {
  PV:      '#F2A93B',
  Wind:    '#4FA8C9',
  Storage: '#7B5EA8',
  Hybrid:  '#5FAE7A',
};

const STATUS_BADGE: Record<ProjectStatus, { color: 'success' | 'warning' | 'info' | 'neutral'; dot?: boolean }> = {
  Operating:    { color: 'success', dot: true },
  Construction: { color: 'warning', dot: true },
  Development:  { color: 'info',    dot: true },
  Permitting:   { color: 'neutral', dot: true },
};

const PAGE_SIZE = 8;

// ── Sub-components ─────────────────────────────────────

const TypeBadge: React.FC<{ type: ProjectType }> = ({ type }) => (
  <span
    className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[12px] font-medium"
    style={{ backgroundColor: `${TYPE_COLORS[type]}15`, color: TYPE_COLORS[type] }}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
    {type}
  </span>
);

const FilterPill: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cn(
      'h-8 px-3 rounded-[var(--radius-md)] text-[13px] font-medium transition-all',
      active
        ? 'bg-[var(--color-brand-500)] text-white'
        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
    )}
  >
    {children}
  </button>
);

// ── Main Page ──────────────────────────────────────────

const ProjectListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | ProjectType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>('All');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [page, setPage] = useState(1);

  // Filter + paginate
  const filtered = useMemo(() => {
    return ALL_PROJECTS.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.location.toLowerCase().includes(q)) return false;
      }
      if (typeFilter !== 'All' && p.type !== typeFilter) return false;
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      return true;
    });
  }, [search, typeFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  React.useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter]);

  return (
    <GlobalShell title="Projects" breadcrumb={['EnergyIQ', 'Projects']}>
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-[var(--text-primary)]">Projects</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              {filtered.length} project{filtered.length !== 1 ? 's' : ''} · Portfolio management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" icon={<span>⬇</span>}>Export CSV</Button>
            <Button variant="primary" size="md" icon={<span>＋</span>}>New Project</Button>
          </div>
        </header>

        {/* ── Filter Bar ── */}
        <Card padding="md">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="w-64">
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Search projects or locations…"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--text-tertiary)] mr-1">Type:</span>
              {(['All', 'PV', 'Wind', 'Storage', 'Hybrid'] as const).map((t) => (
                <FilterPill
                  key={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                >
                  {t}
                </FilterPill>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[var(--text-tertiary)] mr-1">Status:</span>
              {(['All', 'Operating', 'Construction', 'Development', 'Permitting'] as const).map((s) => (
                <FilterPill
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                >
                  {s}
                </FilterPill>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* View Toggle */}
            <SegmentedControl
              options={[
                { label: '📊 Table', value: 'table' },
                { label: '🎴 Cards', value: 'card'  },
              ]}
              value={viewMode}
              onChange={(v) => setViewMode(v as 'table' | 'card')}
            />
          </div>
        </Card>

        {/* ── Results ── */}
        {pageData.length === 0 ? (
          <Card padding="lg">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 text-[var(--text-tertiary)]">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 24h16M24 16v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-[16px] font-medium text-[var(--text-primary)] mb-1">No projects found</h3>
              <p className="text-[14px] text-[var(--text-secondary)]">Try adjusting your filters or search query.</p>
            </div>
          </Card>
        ) : viewMode === 'table' ? (
          /* ── Table View ── */
          <Card padding="md">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  <th className="text-left py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Name</th>
                  <th className="text-left py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Type</th>
                  <th className="text-right py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Capacity (MW)</th>
                  <th className="text-right py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">IRR</th>
                  <th className="text-right py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">LCOE ($/MWh)</th>
                  <th className="text-left py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="text-right py-3 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Updated</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-2">
                      <div className="text-[14px] font-medium text-[var(--text-primary)]">{p.name}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">{p.location}</div>
                    </td>
                    <td className="py-3 px-2"><TypeBadge type={p.type} /></td>
                    <td className="py-3 px-2 text-right text-[14px] font-mono text-[var(--text-primary)]">
                      {p.capacityMW}
                    </td>
                    <td className={cn(
                      'py-3 px-2 text-right text-[14px] font-mono font-medium',
                      p.irr >= 15 ? 'text-[var(--color-success)]' : 'text-[var(--text-primary)]'
                    )}>
                      {p.irr.toFixed(1)}%
                    </td>
                    <td className="py-3 px-2 text-right text-[14px] font-mono text-[var(--text-primary)]">
                      ${p.lcoe.toFixed(1)}
                    </td>
                    <td className="py-3 px-2">
                      <Badge color={STATUS_BADGE[p.status].color} dot={STATUS_BADGE[p.status].dot}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right text-[12px] text-[var(--text-tertiary)]">
                      {p.updated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          /* ── Card View ── */
          <div className="grid grid-cols-3 gap-4">
            {pageData.map((p) => (
              <Card
                key={p.id}
                padding="md"
                className="hover:border-[var(--border-strong)] transition-all cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--text-primary)]">{p.name}</div>
                      <div className="text-[12px] text-[var(--text-tertiary)]">{p.location}</div>
                    </div>
                    <TypeBadge type={p.type} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-default)]">
                    <div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">Capacity</div>
                      <div className="text-[14px] font-mono font-medium text-[var(--text-primary)]">{p.capacityMW} MW</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">IRR</div>
                      <div className={cn(
                        'text-[14px] font-mono font-medium',
                        p.irr >= 15 ? 'text-[var(--color-success)]' : 'text-[var(--text-primary)]'
                      )}>
                        {p.irr.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">LCOE</div>
                      <div className="text-[14px] font-mono font-medium text-[var(--text-primary)]">
                        ${p.lcoe.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                    <Badge color={STATUS_BADGE[p.status].color} dot={STATUS_BADGE[p.status].dot}>
                      {p.status}
                    </Badge>
                    <span className="text-[11px] text-[var(--text-tertiary)]">{p.updated}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-tertiary)]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>
    </GlobalShell>
  );
};

export default ProjectListPage;
