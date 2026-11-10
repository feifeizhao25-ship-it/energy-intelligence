import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packPath = join(dirname(fileURLToPath(import.meta.url)), '../../market-pack.json');

export function loadMarketPack() {
  const pack = JSON.parse(readFileSync(packPath, 'utf8'));
  if (pack.id !== 'intl') throw new Error('market pack id');
  if (pack.default_language !== 'en' || !pack.languages.includes('en')) throw new Error('language');
  return pack;
}

/** Banner stays off unless COOKIE_BANNER=1. The pack default is also off. */
export function cookieBannerEnabled(env = process.env, pack = loadMarketPack()) {
  return env.COOKIE_BANNER === '1' && pack.cookie_banner_enabled === true;
}

/** Essential and functional only. Analytics and marketing cannot be turned on here. */
export function defaultCookieChoice() {
  return { essential: true, functional: true, analytics: false, marketing: false };
}

export function bannerText() {
  return {
    title: 'Cookies',
    body: 'Essential and functional cookies only. Analytics and marketing stay off. Operator name, address, and a counsel-approved notice are not configured.',
    acceptLabel: 'Use essential and functional cookies',
  };
}

export function firstAiNotice(alreadySeen, pack = loadMarketPack()) {
  if (alreadySeen) return null;
  return pack.ai_notice;
}
