'use client';
/**
 * EnergyIQ — International Billing & Subscription Page
 *
 * Four tiers: Free / Pro / Team / Enterprise
 * Payment via Stripe (credit card form placeholder)
 * Stripe Tax auto-calculated
 * Monthly / Annual billing cycle (20% off annual)
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useState } from 'react';
import {
  Button, Input, Card, Badge, SegmentedControl, Switch,
} from '@energy-intelligence/ui-web';
import { cn } from '@energy-intelligence/ui-web';
import GlobalShell from '../components/GlobalShell';

// ── Types ──────────────────────────────────────────────

interface PlanTier {
  id: string;
  name: string;
  monthlyPrice: number | null;  // null = "Custom"
  annualPrice: number | null;
  tagline: string;
  features: string[];
  highlight?: boolean;
  cta: string;
}

// ── Plan Data ──────────────────────────────────────────

const TIERS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    tagline: 'Get started with essential tools',
    features: [
      '3 projects',
      '5 assessments / month',
      '200 AI queries / month',
      'Basic market data',
      'Community support',
    ],
    cta: 'Current Plan',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 39,
    annualPrice: 31,   // ~20% off, rounded
    tagline: 'For independent analysts and consultants',
    features: [
      'Unlimited projects',
      '100 assessments / month',
      '15,000 AI queries / month',
      'Monte Carlo simulation',
      'ERCOT & CAISO LMP data',
      'Email support',
    ],
    highlight: true,
    cta: 'Upgrade to Pro',
  },
  {
    id: 'team',
    name: 'Team',
    monthlyPrice: 99,
    annualPrice: 79,
    tagline: 'For teams that collaborate',
    features: [
      'Everything in Pro',
      'Collaboration & sharing',
      'Role-based access (min 3 seats)',
      'Shared project workspace',
      'Advanced analytics dashboard',
      'Priority support',
    ],
    cta: 'Upgrade to Team',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    tagline: 'For organizations at scale',
    features: [
      'Everything in Team',
      'REST API access',
      'SSO / SAML',
      '99.9% SLA guarantee',
      'Dedicated account manager',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
  },
];

// ── Credit Card Form Placeholder ──

const StripeCardForm: React.FC = () => (
  <div className="space-y-4">
    {/* Card preview */}
    <div className="p-5 rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-brand-600)] to-[var(--color-brand-800)] text-white">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[14px] font-semibold">EnergyIQ</span>
        <span className="text-[11px] opacity-80">Powered by Stripe</span>
      </div>
      <div className="text-[18px] font-mono tracking-widest mb-4 opacity-90">
        •••• •••• •••• 4242
      </div>
      <div className="flex items-center justify-between text-[12px] opacity-80">
        <span>John Doe</span>
        <span>12 / 28</span>
      </div>
    </div>

    {/* Inputs */}
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
        Card Number
      </label>
      <Input
        type="text"
        placeholder="1234 5678 9012 3456"
        maxLength={19}
        className="font-mono"
      />
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
          Expiry Date
        </label>
        <Input type="text" placeholder="MM / YY" maxLength={7} className="font-mono" />
      </div>
      <div>
        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
          CVC
        </label>
        <Input type="text" placeholder="•••" maxLength={4} className="font-mono" />
      </div>
    </div>
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
        Name on Card
      </label>
      <Input type="text" placeholder="John Doe" />
    </div>
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
        Billing ZIP / Postal Code
      </label>
      <Input type="text" placeholder="94105" maxLength={10} className="font-mono" />
    </div>
    <div className="flex items-center gap-2 pt-1">
      <svg width="16" height="16" viewBox="0 0 16 16" className="text-[var(--text-tertiary)]">
        <path d="M8 1l6 3v4c0 3.5-2.5 6.5-6 7.5C4.5 14.5 2 11.5 2 8V4l6-3z"
          fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <span className="text-[11px] text-[var(--text-tertiary)]">
        Payments secured by Stripe. Your card details are encrypted and never stored on our servers.
      </span>
    </div>
  </div>
);

// ── Main Page ──────────────────────────────────────────

const BillingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [autoRenew, setAutoRenew] = useState(true);

  // Current plan mock
  const currentPlan = 'free';

  return (
    <GlobalShell title="Billing" breadcrumb={['EnergyIQ', 'Billing']}>
      <div className="max-w-[1200px] mx-auto space-y-8">

        {/* ── Header ── */}
        <header>
          <h1 className="text-[24px] font-bold text-[var(--text-primary)]">Billing & Subscription</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage your EnergyIQ subscription and payment method
          </p>
        </header>

        {/* ── Current Plan Summary ── */}
        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">Current Plan</span>
                <Badge color="brand">Free</Badge>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                You are on the Free plan. Upgrade to unlock more features.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[var(--text-secondary)]">Auto-renew</span>
              <Switch checked={autoRenew} onChange={setAutoRenew} />
            </div>
          </div>

          {/* Usage bar */}
          <div className="mt-4 pt-4 border-t border-[var(--border-default)] grid grid-cols-3 gap-4">
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[12px] text-[var(--text-secondary)]">Projects</span>
                <span className="text-[13px] font-mono text-[var(--text-primary)]">2 / 3</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-brand-500)]" style={{ width: '67%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[12px] text-[var(--text-secondary)]">Assessments</span>
                <span className="text-[13px] font-mono text-[var(--text-primary)]">3 / 5</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-warning)]" style={{ width: '60%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[12px] text-[var(--text-secondary)]">AI Queries</span>
                <span className="text-[13px] font-mono text-[var(--text-primary)]">87 / 200</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-success)]" style={{ width: '43%' }} />
              </div>
            </div>
          </div>
        </Card>

        {/* ── Billing Cycle Toggle ── */}
        <div className="flex items-center justify-center gap-4">
          <SegmentedControl
            options={[
              { label: 'Monthly',  value: 'monthly' },
              { label: 'Annual (Save 20%)', value: 'annual' },
            ]}
            value={billingCycle}
            onChange={(v) => setBillingCycle(v as 'monthly' | 'annual')}
          />
        </div>

        {/* ── Pricing Tiers ── */}
        <div className="grid grid-cols-4 gap-4">
          {TIERS.map((tier) => {
            const price = billingCycle === 'monthly' ? tier.monthlyPrice : tier.annualPrice;
            const isCurrent = tier.id === currentPlan;
            const isCustom = price === null;

            return (
              <Card
                key={tier.id}
                padding="lg"
                className={cn(
                  'relative flex flex-col',
                  tier.highlight && 'border-2 border-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-200)]'
                )}
              >
                {/* Popular badge */}
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge color="brand">★ Most Popular</Badge>
                  </div>
                )}

                {/* Plan name */}
                <h3 className="text-[18px] font-bold text-[var(--text-primary)]">{tier.name}</h3>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1 min-h-[32px]">
                  {tier.tagline}
                </p>

                {/* Price */}
                <div className="py-4 border-b border-[var(--border-default)]">
                  {isCustom ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[28px] font-bold text-[var(--text-primary)]">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[14px] font-medium text-[var(--text-secondary)]">$</span>
                      <span className="text-[36px] font-bold font-mono text-[var(--text-primary)]">
                        {price}
                      </span>
                      <span className="text-[13px] text-[var(--text-tertiary)]">
                        {tier.id === 'team' ? '/seat/mo' : '/mo'}
                      </span>
                    </div>
                  )}
                  {billingCycle === 'annual' && !isCustom && price !== 0 && (
                    <p className="text-[11px] text-[var(--color-success)] mt-1">
                      Billed annually (${(price * 12).toLocaleString()}/yr)
                    </p>
                  )}
                  {price === 0 && (
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Free forever</p>
                  )}
                </div>

                {/* Features */}
                <ul className="py-4 space-y-2 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)]">
                      <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[var(--color-success)]" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  variant={tier.highlight ? 'primary' : 'secondary'}
                  fullWidth
                  disabled={isCurrent}
                  className="mt-auto"
                >
                  {isCurrent ? '✓ Current Plan' : tier.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* ── Payment Method (Stripe) ── */}
        <Card title="Payment Method" padding="lg">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">Credit Card</span>
                <Badge color="info">Stripe</Badge>
              </div>
              <StripeCardForm />

              {/* Tax note */}
              <div className="mt-4 p-3 rounded-[var(--radius-md)] bg-[var(--bg-secondary)] border border-[var(--border-default)]">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 14 14" className="text-[var(--text-secondary)]">
                    <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7 3v5M7 10v0.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="text-[12px] font-medium text-[var(--text-primary)]">Tax</span>
                  <Badge color="neutral">Stripe Tax</Badge>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Sales tax, VAT, and GST are automatically calculated based on your billing
                  address and applied at checkout via Stripe Tax.
                </p>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">Order Summary</h4>
              <div className="p-4 rounded-[var(--radius-lg)] bg-[var(--bg-secondary)] space-y-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Plan</span>
                  <span className="font-medium text-[var(--text-primary)]">Pro (Annual)</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Billing Cycle</span>
                  <span className="font-medium text-[var(--text-primary)]">Yearly</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Unit Price</span>
                  <span className="font-mono text-[var(--text-primary)]">$31 / mo</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Subtotal</span>
                  <span className="font-mono text-[var(--text-primary)]">$372.00</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">Tax (est. 8.5%)</span>
                  <span className="font-mono text-[var(--text-primary)]">$31.62</span>
                </div>
                <div className="pt-3 border-t border-[var(--border-default)] flex justify-between items-baseline">
                  <span className="text-[14px] font-semibold text-[var(--text-primary)]">Total</span>
                  <span className="text-[20px] font-bold font-mono text-[var(--color-brand-500)]">$403.62</span>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] pt-1">
                  Renews automatically on your next billing date. Cancel anytime.
                </p>
              </div>
              <Button variant="primary" fullWidth size="lg" className="mt-4">
                Subscribe with Stripe
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Billing History ── */}
        <Card title="Billing History" padding="md">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="text-left py-2 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Date</th>
                <th className="text-left py-2 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Description</th>
                <th className="text-left py-2 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Status</th>
                <th className="text-right py-2 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Amount</th>
                <th className="text-right py-2 px-2 text-[12px] font-medium text-[var(--text-secondary)]">Receipt</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--border-default)]">
                <td className="py-3 px-2 text-[13px] text-[var(--text-secondary)]">Jun 1, 2026</td>
                <td className="py-3 px-2 text-[13px] text-[var(--text-primary)]">Free Plan — No charge</td>
                <td className="py-3 px-2"><Badge color="neutral">N/A</Badge></td>
                <td className="py-3 px-2 text-right text-[13px] font-mono text-[var(--text-primary)]">$0.00</td>
                <td className="py-3 px-2 text-right">
                  <Button variant="ghost" size="sm">—</Button>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

      </div>
    </GlobalShell>
  );
};

export default BillingPage;
