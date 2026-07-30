'use client';
/**
 * EnergyIQ — Incentives (ITC) Page
 *
 * - Interactive ITC calculator: capex in → credit out. The math is real
 *   client-side arithmetic on user input; results are labeled as an
 *   illustrative estimate, not tax advice.
 * - IRA bonus credit stack and key deadlines as static reference content.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import { Badge, Card, Input, Switch, cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../GlobalShell';
import DemoBadge from '../DemoBadge';

const BASE_ITC_RATE = 0.3;

interface BonusCredit {
  id: string;
  label: string;
  rate: number;
  note: string;
}

const BONUS_CREDITS: BonusCredit[] = [
  {
    id: 'domestic-content',
    label: 'Domestic Content Bonus',
    rate: 0.1,
    note: 'Qualifying US-manufactured steel, iron and components',
  },
  {
    id: 'energy-community',
    label: 'Energy Community Bonus',
    rate: 0.1,
    note: 'Brownfields, coal communities and former fossil sites',
  },
  {
    id: 'low-income',
    label: 'Low-Income Bonus',
    rate: 0.1,
    note: 'Facilities serving low-income communities (capacity-limited allocation)',
  },
];

const fmtUSD = (value: number) =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

const IncentivesPage: React.FC = () => {
  const [capexRaw, setCapexRaw] = useState('10000000');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  const capex = useMemo(() => {
    const parsed = Number(capexRaw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [capexRaw]);

  const rate = useMemo(
    () =>
      BONUS_CREDITS.reduce(
        (acc, bonus) => acc + (enabled[bonus.id] ? bonus.rate : 0),
        BASE_ITC_RATE,
      ),
    [enabled],
  );

  const credit = capex * rate;
  const netCapex = Math.max(capex - credit, 0);

  return (
    <GlobalShell
      title="Incentives (ITC)"
      breadcrumb={['EnergyIQ', 'Incentives']}
      headerExtra={<DemoBadge />}
    >
      <div className="max-w-[1100px] mx-auto space-y-6">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">
            Federal tax incentives
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Estimate the Investment Tax Credit under the Inflation Reduction Act and see how
            bonus credits stack for qualifying projects.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── ITC Calculator ── */}
          <Card
            title={
              <span className="inline-flex items-center gap-2">
                ITC Calculator
                <Badge color="brand">Illustrative estimate</Badge>
              </span>
            }
            padding="lg"
          >
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="itc-capex"
                  className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5"
                >
                  Eligible capital expenditure (USD)
                </label>
                <Input
                  id="itc-capex"
                  inputMode="decimal"
                  value={capexRaw}
                  onChange={(e) => setCapexRaw(e.target.value)}
                  placeholder="10,000,000"
                  icon={<span className="text-[13px]">$</span>}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text-primary)]">Base ITC rate</span>
                  <span className="text-[13px] font-mono font-medium text-[var(--text-primary)]">
                    30%
                  </span>
                </div>
                {BONUS_CREDITS.map((bonus) => (
                  <div
                    key={bonus.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-default)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">
                        {bonus.label}
                        <span className="ml-2 text-[12px] font-mono text-[var(--color-success)]">
                          +10%
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {bonus.note}
                      </div>
                    </div>
                    <Switch
                      checked={!!enabled[bonus.id]}
                      onChange={(checked) =>
                        setEnabled((prev) => ({ ...prev, [bonus.id]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-[var(--radius-md)] bg-[var(--bg-secondary)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text-secondary)]">Effective ITC rate</span>
                  <span className="text-[15px] font-mono font-semibold text-[var(--text-primary)]">
                    {(rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--text-secondary)]">
                    Estimated tax credit
                  </span>
                  <span className="text-[20px] font-mono font-bold text-[var(--color-success)]">
                    {fmtUSD(credit)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                  <span className="text-[13px] text-[var(--text-secondary)]">
                    Net capex after credit
                  </span>
                  <span className="text-[15px] font-mono font-semibold text-[var(--text-primary)]">
                    {fmtUSD(netCapex)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                Illustrative estimate only, computed locally from your inputs. Actual credit
                eligibility depends on prevailing wage and apprenticeship rules, placed-in-service
                timing and IRS guidance. Consult a tax advisor before making investment decisions.
              </p>
            </div>
          </Card>

          {/* ── Reference column ── */}
          <div className="space-y-6">
            <Card title="How the credit stack works" padding="lg">
              <ul className="space-y-3">
                {[
                  'The base ITC covers 30% of eligible costs for solar, wind and stand-alone storage that meet prevailing wage and apprenticeship requirements.',
                  'Bonus credits add 10 percentage points each and can stack, bringing the effective rate to 40–60% for qualifying projects.',
                  'Credits can be monetized through direct pay (tax-exempt owners) or transferred once to an unrelated taxpayer for cash.',
                ].map((line) => (
                  <li
                    key={line.slice(0, 24)}
                    className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--text-secondary)]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-500)]" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>

            <Card
              title={
                <span className="inline-flex items-center gap-2">
                  <Landmark size={15} className="text-[var(--color-brand-500)]" />
                  Key deadlines
                </span>
              }
              padding="lg"
            >
              <div className="space-y-3">
                {[
                  { period: 'Through 2032', detail: 'Full 30% base ITC for qualifying projects' },
                  { period: '2033', detail: 'Base rate steps down to 26%' },
                  { period: '2034', detail: 'Base rate steps down to 22%' },
                ].map((row) => (
                  <div
                    key={row.period}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-[var(--radius-md)]',
                      'border border-[var(--border-default)]',
                    )}
                  >
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">
                      {row.period}
                    </span>
                    <span className="text-[12px] text-[var(--text-secondary)]">{row.detail}</span>
                  </div>
                ))}
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Schedule reflects current statute; pending legislation may change step-down
                  timing. Track updates on the Policies page.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </GlobalShell>
  );
};

export default IncentivesPage;
