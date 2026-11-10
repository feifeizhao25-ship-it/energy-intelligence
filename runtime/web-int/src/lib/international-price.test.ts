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

function featureList(page: string, id: string): string[] {
  const match = page.match(new RegExp(`id: '${id}'[\\s\\S]*?features: \\[([^\\]]+)\\]`));
  assert.ok(match, `features for ${id}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

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

test('team and enterprise seat copy matches the enforced registry', () => {
  const registry = JSON.parse(readFileSync(join(ROOT, 'runtime/backend/data/entitlements.json'), 'utf8'));
  const page = readFileSync(join(ROOT, 'runtime/web-int/src/app/pricing/page.tsx'), 'utf8');
  const teamSeats = registry.tiers.team.collaboration.team_seats;
  const enterpriseSeats = registry.tiers.enterprise.collaboration.team_seats;
  assert.equal(teamSeats, 10);
  assert.equal(enterpriseSeats, 10);
  assert.match(page, new RegExp(`${teamSeats} team seats`));
  assert.match(page, /ten-person/);
  assert.match(page, /10 seats included, more by contract/);
  assert.doesNotMatch(page, /5 team accounts|five-person|From 20 seats/);

  const enterprise = registry.tiers.enterprise;
  const features = featureList(page, 'enterprise');
  const apiOn = enterprise.capabilities?.tiered_api === true
    || (enterprise.export?.formats || []).includes('api');
  const mentions = (word) => features.filter((line) => line.toLowerCase().includes(word));
  const offered = (lines) => lines.some((line) => !/not available/i.test(line));
  if (apiOn) assert.equal(offered(mentions('api')), true);
  else assert.equal(mentions('api').length, 0);
  if (enterprise.collaboration.sso) assert.equal(offered(mentions('sso')), true);
  else assert.equal(offered(mentions('sso')), false);
  if (enterprise.collaboration.white_label) assert.equal(offered(mentions('white-label')), true);
  else assert.equal(offered(mentions('white-label')), false);
  if (enterprise.service?.private_deployment === true) {
    assert.ok(features.includes('Private deployment assessment'));
  }
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
