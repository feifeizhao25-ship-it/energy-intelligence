import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  PRICE_UNAVAILABLE,
  internationalPriceLabel,
  resolveInternationalPrice,
} from './internationalPrice';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../');

function stripeResponse(currency: string, amount = 41900) {
  return async () => ({
    ok: true,
    json: async () => ({ unit_amount: amount, currency }),
  }) as unknown as Response;
}

describe('international plan prices', () => {
  it('shows a configured USD Stripe Price and ignores a CNY registry amount', async () => {
    const label = await resolveInternationalPrice('pro', {
      env: { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRO_PRICE_ID: 'price_pro' },
      fetchImpl: stripeResponse('usd') as unknown as typeof fetch,
      registry: { yearly_cny: 1980, monthly_cny: 0 },
    });
    expect(label).toBe('USD 419.00');
  });

  it('uses a registry USD amount when Stripe is not configured', () => {
    expect(internationalPriceLabel({
      planId: 'team',
      registry: { currency: 'USD', yearly_usd_cents: 250000, yearly_cny: 16800 },
    })).toBe('USD 2,500.00');
  });

  it('says price unavailable when the Stripe Price is not USD or is missing', async () => {
    const cny = await resolveInternationalPrice('pro', {
      env: { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRO_PRICE_ID: 'price_pro' },
      fetchImpl: stripeResponse('cny') as unknown as typeof fetch,
      registry: { yearly_cny: 1980 },
    });
    expect(cny).toBe(PRICE_UNAVAILABLE);
    expect(internationalPriceLabel({ planId: 'enterprise', registry: { yearly_cny: 33000 } })).toBe(PRICE_UNAVAILABLE);
    const missing = await resolveInternationalPrice('pro', { env: {}, registry: null });
    expect(missing).toBe(PRICE_UNAVAILABLE);
  });

  it('keeps the free plan free and leaves the domestic checkout in yuan', () => {
    expect(internationalPriceLabel({ planId: 'free', registry: { yearly_cny: 0 } })).toBe('Free');
    const registry = JSON.parse(readFileSync(join(ROOT, 'runtime/backend/data/entitlements.json'), 'utf8'));
    expect(registry.tiers.pro.price.yearly_cny).toBe(1980);
    const checkout = readFileSync(join(ROOT, 'runtime/web/src/app/(dashboard)/checkout/checkout-client.tsx'), 'utf8');
    expect(checkout).toContain('¥${amount}');
    expect(checkout).toContain('支付宝支付 ¥${amount}');
  });
});
