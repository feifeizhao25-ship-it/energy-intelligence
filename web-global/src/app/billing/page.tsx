import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import BillingPage, { type PlanTier } from '../../pages/BillingPage';
import { resolveInternationalPrice, type RegistryPrice } from '../../lib/billing/internationalPrice';

const PLAN_IDS = ['free', 'pro', 'team', 'enterprise'] as const;

const TAGLINES: Record<(typeof PLAN_IDS)[number], { tagline: string; cta: string; highlight?: boolean }> = {
  free: { tagline: 'Validate one project workflow before procurement.', cta: 'Current Plan' },
  pro: { tagline: 'For analysts developing reviewable calculation cases.', cta: 'Upgrade to Professional', highlight: true },
  team: { tagline: 'For teams sharing projects and a quarterly brief.', cta: 'Upgrade to Team' },
  enterprise: { tagline: 'For governed integrations and multi-team rollouts.', cta: 'Contact Sales' },
};

type TierRecord = {
  name_en?: string;
  description_en?: string;
  features_en?: string[];
  price?: RegistryPrice;
  quotas?: { max_projects?: number; calculations_per_day?: number; ai_queries_per_day?: number };
};

function limitText(value: number | undefined, suffix: string): string {
  if (value === undefined) return '—';
  if (value < 0) return 'Unlimited';
  return suffix ? `${value} ${suffix}` : String(value);
}

export default async function BillingRoute() {
  const registry = JSON.parse(readFileSync(join(process.cwd(), '../runtime/backend/data/entitlements.json'), 'utf8')) as {
    tiers: Record<string, TierRecord>;
  };
  const prices: Record<string, string> = {};
  const tiers: PlanTier[] = [];
  for (const id of PLAN_IDS) {
    const tier = registry.tiers[id];
    prices[id] = await resolveInternationalPrice(id, { registry: tier?.price ?? null });
    const copy = TAGLINES[id];
    tiers.push({
      id,
      name: tier?.name_en || id,
      tagline: tier?.description_en || copy.tagline,
      features: tier?.features_en || [],
      highlight: copy.highlight,
      cta: copy.cta,
    });
  }
  const free = registry.tiers.free?.quotas || {};
  return (
    <BillingPage
      prices={prices}
      tiers={tiers}
      freeLimits={{
        projects: limitText(free.max_projects, ''),
        calculations: limitText(free.calculations_per_day, '/ day'),
        ai: limitText(free.ai_queries_per_day, '/ day'),
      }}
    />
  );
}
