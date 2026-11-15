/**
 * International plan prices are US dollars only.
 * A number is shown only when it was read from a configured Stripe Price in USD,
 * or from a USD amount on the registry. CNY figures are never displayed.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRICE_UNAVAILABLE = 'price unavailable';

export type StripePrice = {
  priceId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
};

export type RegistryPrice = {
  yearly_cny?: number | null;
  monthly_cny?: number | null;
  yearly_usd_cents?: number | null;
  currency?: string | null;
};

const STRIPE_PRICE_ENV: Record<string, string> = {
  pro: 'STRIPE_PRO_PRICE_ID',
  full: 'STRIPE_FULL_PRICE_ID',
  team: 'STRIPE_TEAM_PRICE_ID',
  enterprise: 'STRIPE_ENTERPRISE_PRICE_ID',
};

const REGISTRY = join(dirname(fileURLToPath(import.meta.url)), '../../../backend/data/entitlements.json');

export function formatUsdCents(cents: number): string {
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `USD ${text}`;
}

function isUsdCents(cents: number | null | undefined): cents is number {
  return typeof cents === 'number' && Number.isInteger(cents) && cents >= 0;
}

export function internationalPriceLabel(input: {
  planId: string;
  stripe?: StripePrice | null;
  registry?: RegistryPrice | null;
}): string {
  if (input.planId === 'free') return 'Free';
  const stripe = input.stripe;
  if (
    stripe?.priceId
    && String(stripe.currency || '').toUpperCase() === 'USD'
    && isUsdCents(stripe.amountCents)
  ) {
    return formatUsdCents(stripe.amountCents);
  }
  const registry = input.registry;
  if (
    registry
    && String(registry.currency || '').toUpperCase() === 'USD'
    && isUsdCents(registry.yearly_usd_cents)
  ) {
    return formatUsdCents(registry.yearly_usd_cents);
  }
  return PRICE_UNAVAILABLE;
}

export function registryPrice(planId: string): RegistryPrice | null {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8')) as {
    tiers?: Record<string, { price?: RegistryPrice }>;
  };
  return registry.tiers?.[planId]?.price ?? null;
}

export async function readStripePrice(
  planId: string,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<StripePrice | null> {
  const envKey = STRIPE_PRICE_ENV[planId];
  const priceId = envKey ? env[envKey] : undefined;
  const secret = env.STRIPE_SECRET_KEY;
  if (!priceId || !secret) return null;
  try {
    const response = await fetchImpl(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) return null;
    const body = await response.json() as { unit_amount?: number | null; currency?: string | null };
    return { priceId, amountCents: body.unit_amount ?? null, currency: body.currency ?? null };
  } catch {
    return null;
  }
}

export async function resolveInternationalPrice(
  planId: string,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    registry?: RegistryPrice | null;
    useRegistryFile?: boolean;
  } = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const stripe = await readStripePrice(planId, env, options.fetchImpl ?? fetch);
  const registry = options.registry !== undefined
    ? options.registry
    : options.useRegistryFile === false
      ? null
      : registryPrice(planId);
  return internationalPriceLabel({ planId, stripe, registry });
}
