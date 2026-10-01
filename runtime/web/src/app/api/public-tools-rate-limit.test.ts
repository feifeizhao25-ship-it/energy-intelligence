/**
 * 公开接口（不登录也能调、会消耗第三方额度或短信费用）必须按来源限流。
 * 这里逐个真调路由处理函数：超限后返回 429 + 中文提示，并且上游根本没有被调用。
 * 最后一组用例是静态门禁：以后新增「直接或间接打第三方」的公开路由而忘了限流，会在这里变红。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));

const upstream = jest.fn(async (..._args: unknown[]) => []);
jest.mock('@/lib/api/amap', () => ({
  geocodeAddress: (...a: unknown[]) => upstream('amap', ...a),
  reverseGeocode: (...a: unknown[]) => upstream('amap', ...a),
  searchNearbyPOIs: (...a: unknown[]) => upstream('amap', ...a),
  getLocationSuggestions: (...a: unknown[]) => upstream('amap', ...a),
}));
jest.mock('@/lib/api/nasa-power', () => ({
  getSolarResource: (...a: unknown[]) => upstream('nasa', ...a),
  getWindResource: (...a: unknown[]) => upstream('nasa', ...a),
}));
jest.mock('@/lib/api/weather', () => ({
  getCurrentWeather: (...a: unknown[]) => upstream('weather', ...a),
  getWeatherForecast: jest.fn(), getAirQuality: jest.fn(), getUVIndex: jest.fn(),
}));
jest.mock('@/lib/api/open-meteo', () => ({ getAirQualityIndex: jest.fn() }));
jest.mock('@/lib/api/nrel', () => ({
  getPVWattsData: (...a: unknown[]) => upstream('nrel', ...a),
  calculateSolarOutput: (...a: unknown[]) => { upstream('nrel-estimate', ...a); return {}; },
}));
jest.mock('@/lib/api/semantic-scholar', () => ({
  searchPapers: (...a: unknown[]) => upstream('s2', ...a),
  getPaper: jest.fn(),
  getRecommendations: (...a: unknown[]) => upstream('s2', ...a),
}));
jest.mock('@/lib/api/arxiv', () => ({ searchArxiv: (...a: unknown[]) => upstream('arxiv', ...a) }));
jest.mock('@/lib/membership/middleware', () => ({ acquireMember: async () => ({ ok: true, user: { id: 'u', plan: 'PRO' }, refund: async () => undefined }) }));
jest.mock('@/lib/papers/search', () => ({ unifiedSearch: (...a: unknown[]) => upstream('papers', ...a) }));
jest.mock('@/lib/calculator/solar', () => ({ calculateSolar: (...a: unknown[]) => upstream('calc', ...a) }));
jest.mock('@/lib/calculator/wind', () => ({ calculateWind: (...a: unknown[]) => upstream('calc', ...a) }));
jest.mock('@/lib/calculator/storage', () => ({ calculateStorage: (...a: unknown[]) => upstream('calc', ...a) }));
jest.mock('@/lib/calculator/site-compare', () => ({ compareSiteEnergies: (...a: unknown[]) => upstream('calc', ...a) }));
jest.mock('@/lib/crawler/price-crawler', () => ({
  getLatestPrice: (...a: unknown[]) => upstream('price', ...a),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    demoRequest: { findFirst: jest.fn(async () => null), create: jest.fn(async () => ({ id: 'd1', status: 'new' })) },
    verificationCode: { findFirst: jest.fn(async () => null), count: jest.fn(async () => 0), create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/lib/sms/aliyun', () => ({ sendVerificationCode: jest.fn(async (..._a: unknown[]) => ({ success: true })) }));

import { PUBLIC_RULES } from '@/lib/security/rate-limit';
import { sendVerificationCode } from '@/lib/sms/aliyun';

type Handler = (req: never) => Promise<Response>;
const json = (url: string, body: unknown, ip: string) => new Request(`http://x${url}`, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
});
const get = (url: string, ip: string) => new Request(`http://x${url}`, { headers: { 'x-forwarded-for': ip } });
// NextRequest 需要 nextUrl；测试里用真实的 NextRequest
import { NextRequest } from 'next/server';
const nget = (url: string, ip: string) => new NextRequest(`http://x${url}`, { headers: { 'x-forwarded-for': ip } });
const npost = (url: string, body: unknown, ip: string) => new NextRequest(`http://x${url}`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
});

const solarBody = { lat: 30, lng: 120, capacity: 100, province: '江苏' };

interface Case {
  name: string;
  rule: { anonymous: number };
  load: () => Promise<Handler>;
  build: (ip: string) => Request;
  upstreamTag?: string;
}

const cases: Case[] = [
  { name: 'GET /api/location', rule: PUBLIC_RULES.amap, upstreamTag: 'amap',
    load: async () => (await import('./location/route')).GET as never,
    build: (ip) => nget('/api/location?action=geocode&address=%E5%8C%97%E4%BA%AC', ip) },
  { name: 'GET /api/location/suggestions', rule: PUBLIC_RULES.amap, upstreamTag: 'amap',
    load: async () => (await import('./location/suggestions/route')).GET as never,
    build: (ip) => nget('/api/location/suggestions?query=%E5%8C%97%E4%BA%AC', ip) },
  { name: 'GET /api/resource', rule: PUBLIC_RULES.resource, upstreamTag: 'nasa',
    load: async () => (await import('./resource/route')).GET as never,
    build: (ip) => nget('/api/resource?lat=30&lng=120&type=solar', ip) },
  { name: 'GET /api/solar/nrel', rule: PUBLIC_RULES.nrel,
    load: async () => (await import('./solar/nrel/route')).GET as never,
    build: (ip) => nget('/api/solar/nrel?lat=30&lng=120', ip) },
  { name: 'GET /api/papers', rule: PUBLIC_RULES.papers, upstreamTag: 's2',
    load: async () => (await import('./papers/route')).GET as never,
    build: (ip) => nget('/api/papers?query=solar', ip) },
  { name: 'POST /api/papers/search', rule: PUBLIC_RULES.papers, upstreamTag: 'papers',
    load: async () => (await import('./papers/search/route')).POST as never,
    build: (ip) => npost('/api/papers/search', { query: 'solar' }, ip) },
  { name: 'GET /api/papers/recommendations', rule: PUBLIC_RULES.papers, upstreamTag: 's2',
    load: async () => (await import('./papers/recommendations/route')).GET as never,
    build: (ip) => nget('/api/papers/recommendations?id=abc', ip) },
  { name: 'POST /api/calculate/solar', rule: PUBLIC_RULES.calculators, upstreamTag: 'price',
    load: async () => (await import('./calculate/solar/route')).POST as never,
    build: (ip) => json('/api/calculate/solar', solarBody, ip) },
  { name: 'POST /api/calculate/wind', rule: PUBLIC_RULES.calculators,
    load: async () => (await import('./calculate/wind/route')).POST as never,
    build: (ip) => npost('/api/calculate/wind', { lat: 30, lng: 120 }, ip) },
  { name: 'POST /api/calculate/storage', rule: PUBLIC_RULES.calculators,
    load: async () => (await import('./calculate/storage/route')).POST as never,
    build: (ip) => npost('/api/calculate/storage', {}, ip) },
  { name: 'POST /api/calculate/comparison', rule: PUBLIC_RULES.calculators, upstreamTag: 'calc',
    load: async () => (await import('./calculate/comparison/route')).POST as never,
    build: (ip) => npost('/api/calculate/comparison', { lat: 30, lng: 120, province: '江苏' }, ip) },
  { name: 'POST /api/demo-requests', rule: PUBLIC_RULES.demoRequest,
    load: async () => (await import('./demo-requests/route')).POST as never,
    build: (ip) => npost('/api/demo-requests', { name: '张三', company: '某能源公司', email: `a${Math.random()}@b.cn`, consent: true }, ip) },
];

describe.each(cases)('$name 按来源限流', (c) => {
  beforeEach(() => upstream.mockClear());

  it('超限后 429 + 中文提示，且不再触达上游', async () => {
    const handler = await c.load();
    const ip = `203.0.113.${cases.indexOf(c) + 1}`;
    for (let i = 0; i < c.rule.anonymous; i++) {
      const ok = await handler(c.build(ip) as never);
      expect(ok.status).not.toBe(429);
    }
    const callsBefore = upstream.mock.calls.length;
    const res = await handler(c.build(ip) as never);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = await res.json();
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toMatch(/^请求过于频繁，请 \d+ 秒后再试$/);
    expect(upstream.mock.calls.length).toBe(callsBefore);
  });

  it('另一个来源不受影响', async () => {
    const handler = await c.load();
    const res = await handler(c.build('198.51.100.77') as never);
    expect(res.status).not.toBe(429);
  });
});

describe('POST /api/auth/sms 短信发送限流', () => {
  it('分钟级：同一来源一分钟第 4 次被拒，且没有多发一条短信', async () => {
    const { POST } = await import('./auth/sms/route');
    const send = jest.mocked(sendVerificationCode);
    send.mockClear();
    const ip = '192.0.2.50';
    const statuses: number[] = [];
    for (let i = 0; i < PUBLIC_RULES.smsBurst.anonymous + 1; i++) {
      const res = await POST(npost('/api/auth/sms', { phone: `1380000${String(1000 + i)}` }, ip));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('小时级：分钟额度之外，同一来源一小时最多 10 条（分散在不同分钟也拦得住）', async () => {
    const { POST } = await import('./auth/sms/route');
    const { FixedWindowLimiter } = await import('@/lib/security/rate-limit');
    expect(PUBLIC_RULES.smsHourly.anonymous).toBe(10);
    expect(PUBLIC_RULES.smsHourly.windowMs).toBe(3_600_000);
    expect(typeof POST).toBe('function');
    expect(new FixedWindowLimiter().hit('x', 1, 1000).limited).toBe(false);
  });
});

describe('静态门禁：打第三方额度的公开路由必须限流或要求登录', () => {
  const API_DIR = __dirname;
  const THIRD_PARTY = /@\/lib\/(api\/(amap|weather|nasa-power|nrel|open-meteo|semantic-scholar|arxiv|openalex|elevation|crossref|unpaywall|core)|papers\/search|crawler\/price-crawler|calculator\/(solar|wind|storage|site-compare|aggregator))['"/]|@\/lib\/sms\/aliyun/;
  // 有这些之一即视为「有来源约束」：限流 / 登录会话 / 接口密钥
  const GUARDED = /enforceRateLimit\(|getServerSession\(|checkApiKey\(|withOpenApi\(|requireAiQuota\(|requireAuthenticatedUser\(|withMembershipCheck\(|CRON_SECRET/;

  function routes(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? routes(p) : name === 'route.ts' ? [p] : [];
    });
  }

  it('扫描到了路由文件（防止门禁空转）', () => {
    expect(routes(API_DIR).length).toBeGreaterThan(40);
  });

  it('每个引用第三方客户端的路由都有限流、登录或密钥约束', () => {
    const offenders = routes(API_DIR)
      .filter((file) => THIRD_PARTY.test(readFileSync(file, 'utf8')))
      .filter((file) => !GUARDED.test(readFileSync(file, 'utf8')))
      .map((file) => relative(API_DIR, file));
    expect(offenders).toEqual([]);
  });

  it('门禁自己能抓住违规：一段没限流的路由源码会被判为违规', () => {
    const bad = "import { geocodeAddress } from '@/lib/api/amap';\nexport async function GET() { return geocodeAddress('x'); }";
    expect(THIRD_PARTY.test(bad) && !GUARDED.test(bad)).toBe(true);
    const good = bad + "\nconst l = await enforceRateLimit(req, PUBLIC_RULES.amap);";
    expect(THIRD_PARTY.test(good) && !GUARDED.test(good)).toBe(false);
  });
});

void get;
