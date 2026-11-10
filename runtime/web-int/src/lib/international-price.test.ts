import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PRICE_UNAVAILABLE,
  internationalPriceLabel,
  registryPrice,
  resolveInternationalPrice,
} from './international-price.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function stripeResponse(currency: string, amount = 41900) {
  return async () => ({
    ok: true,
    json: async () => ({ unit_amount: amount, currency }),
  });
}

test('a configured USD Stripe Price is shown and a CNY registry amount is not', async () => {
  const label = await resolveInternationalPrice('pro', {
    env: { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRO_PRICE_ID: 'price_pro' },
    fetchImpl: stripeResponse('usd') as unknown as typeof fetch,
    registry: { yearly_cny: 1980, monthly_cny: 0 },
  });
  assert.equal(label, 'USD 419.00');
});

test('a registry USD amount is used when Stripe is not configured', () => {
  assert.equal(internationalPriceLabel({
    planId: 'full',
    registry: { currency: 'USD', yearly_usd_cents: 880000, yearly_cny: 5800 },
  }), 'USD 8,800.00');
});

test('missing or non-USD prices say price unavailable', async () => {
  const cny = await resolveInternationalPrice('enterprise', {
    env: { STRIPE_SECRET_KEY: 'sk_test', STRIPE_ENTERPRISE_PRICE_ID: 'price_ent' },
    fetchImpl: stripeResponse('cny', 3300000) as unknown as typeof fetch,
    useRegistryFile: false,
  });
  assert.equal(cny, PRICE_UNAVAILABLE);
  assert.equal(internationalPriceLabel({
    planId: 'pro',
    registry: registryPrice('pro'),
  }), PRICE_UNAVAILABLE);
  const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/pricing/page.tsx'), 'utf8');
  assert.equal(page.includes('CNY'), false);
  assert.equal(page.includes('1,980'), false);
});

test('the free plan stays free and the domestic checkout stays in yuan', () => {
  assert.equal(internationalPriceLabel({ planId: 'free', registry: registryPrice('free') }), 'Free');
  const registry = JSON.parse(readFileSync(join(ROOT, 'runtime/backend/data/entitlements.json'), 'utf8'));
  assert.equal(registry.tiers.pro.price.yearly_cny, 1980);
  const checkout = readFileSync(join(ROOT, 'runtime/web/src/app/(dashboard)/checkout/checkout-client.tsx'), 'utf8');
  assert.equal(checkout.includes('¥${amount}'), true);
});
