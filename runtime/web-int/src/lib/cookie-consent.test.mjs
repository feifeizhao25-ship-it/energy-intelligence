import assert from 'node:assert/strict';
import test from 'node:test';
import { bannerText, cookieBannerEnabled, defaultCookieChoice, firstAiNotice, loadMarketPack } from './cookie-consent.mjs';

test('international market pack is English and does not turn the banner on', () => {
  const pack = loadMarketPack();
  assert.deepEqual(pack.languages, ['en']);
  assert.equal(pack.cookie_banner_enabled, false);
  assert.equal(pack.non_essential_cookies, 'rejected');
  assert.equal(cookieBannerEnabled({}), false);
  assert.equal(cookieBannerEnabled({ COOKIE_BANNER: '1' }, pack), false);
});

test('non-essential cookies stay rejected', () => {
  const choice = defaultCookieChoice();
  assert.equal(choice.essential, true);
  assert.equal(choice.functional, true);
  assert.equal(choice.analytics, false);
  assert.equal(choice.marketing, false);
  const text = JSON.stringify(bannerText());
  assert.equal(text.includes('Analytics and marketing stay off'), true);
  assert.equal(/Ltd|Inc\.|有限公司|备案/.test(text), false);
});

test('the generated-text notice is shown once', () => {
  const first = firstAiNotice(false);
  assert.equal(typeof first, 'string');
  assert.equal(first.includes('Generated text'), true);
  assert.equal(firstAiNotice(true), null);
});
