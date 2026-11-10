import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import BillingPage from '../../pages/BillingPage';
import { resolveInternationalPrice, type RegistryPrice } from '../../lib/billing/internationalPrice';

const PLAN_IDS = ['free', 'pro', 'team', 'enterprise'];

export default async function BillingRoute() {
  const registry = JSON.parse(readFileSync(join(process.cwd(), '../runtime/backend/data/entitlements.json'), 'utf8')) as {
    tiers: Record<string, { price?: RegistryPrice }>;
  };
  const prices: Record<string, string> = {};
  for (const id of PLAN_IDS) {
    prices[id] = await resolveInternationalPrice(id, { registry: registry.tiers[id]?.price ?? null });
  }
  return <BillingPage prices={prices} />;
}
