jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => null) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import {
  FixedWindowLimiter, enforceRateLimit, limitedResponse, PUBLIC_RULES, type PublicToolRule,
} from './rate-limit';

const req = (ip = '1.2.3.4', headers: Record<string, string> = {}) =>
  new Request('http://x/api/location', { headers: { 'x-forwarded-for': ip, ...headers } });
const SESSION = { cookie: 'next-auth.session-token=abc' };
const rule: PublicToolRule = { name: 't', anonymous: 3, authenticated: 5, windowMs: 60_000 };

describe('固定窗口限流器', () => {
  it('窗口内超过上限即拒绝，并给出还需等待的秒数', () => {
    let t = 1_000_000;
    const l = new FixedWindowLimiter(100, () => t);
    for (let i = 0; i < 3; i++) expect(l.hit('k', 3, 60_000).limited).toBe(false);
    const r = l.hit('k', 3, 60_000);
    expect(r.limited).toBe(true);
    expect(r.retryAfterSec).toBe(60);
    t += 45_000;
    expect(l.hit('k', 3, 60_000).retryAfterSec).toBe(15);
  });

  it('窗口过后恢复；不同 key 互不影响', () => {
    let t = 0;
    const l = new FixedWindowLimiter(100, () => t);
    for (let i = 0; i < 4; i++) l.hit('a', 3, 1000);
    expect(l.hit('a', 3, 1000).limited).toBe(true);
    expect(l.hit('b', 3, 1000).limited).toBe(false);
    t += 1001;
    expect(l.hit('a', 3, 1000).limited).toBe(false);
  });

  it('被拒绝的请求不会延长窗口（不会越限越久）', () => {
    let t = 0;
    const l = new FixedWindowLimiter(100, () => t);
    for (let i = 0; i < 50; i++) l.hit('a', 3, 1000);
    t += 1001;
    expect(l.hit('a', 3, 1000).limited).toBe(false);
  });

  it('内存有上限：先清过期项，仍满则淘汰最旧的，永远不超过上限', () => {
    let t = 0;
    const l = new FixedWindowLimiter(50, () => t);
    for (let i = 0; i < 500; i++) l.hit(`k${i}`, 1, 60_000);
    expect(l.size()).toBeLessThanOrEqual(50);
    t += 61_000;
    l.hit('fresh', 1, 60_000);
    expect(l.size()).toBe(1);
  });
});

describe('enforceRateLimit', () => {
  beforeEach(() => jest.mocked(getServerSession).mockResolvedValue(null));

  it('未登录按来源 IP 计数：同一 IP 第 4 次被拒，返回 429 与中文提示', async () => {
    const l = new FixedWindowLimiter();
    for (let i = 0; i < 3; i++) expect(await enforceRateLimit(req('9.9.9.9'), rule, l)).toBeNull();
    const res = await enforceRateLimit(req('9.9.9.9'), rule, l);
    expect(res!.status).toBe(429);
    expect(Number(res!.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = await res!.json();
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.error).toMatch(/请求过于频繁.*秒/);
    expect(JSON.stringify(body)).not.toMatch(/[A-Za-z]{4,}\s[A-Za-z]{3,}/); // 没有英文句子
  });

  it('换一个 IP 不受影响', async () => {
    const l = new FixedWindowLimiter();
    for (let i = 0; i < 4; i++) await enforceRateLimit(req('9.9.9.9'), rule, l);
    expect(await enforceRateLimit(req('8.8.8.8'), rule, l)).toBeNull();
  });

  it('伪造 X-Forwarded-For 前缀绕不过：取网关追加的最后一跳', async () => {
    const l = new FixedWindowLimiter();
    let last: Response | null = null;
    for (let i = 0; i < 4; i++) last = await enforceRateLimit(req(`10.0.0.${i}, 7.7.7.7`), rule, l);
    expect(last!.status).toBe(429);
  });

  it('已登录按用户计数（额度更高），与 IP 无关', async () => {
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } } as never);
    const l = new FixedWindowLimiter();
    for (let i = 0; i < 5; i++) expect(await enforceRateLimit(req(`1.1.1.${i}`, SESSION), rule, l)).toBeNull();
    expect((await enforceRateLimit(req('1.1.1.99', SESSION), rule, l))!.status).toBe(429);
    // 另一个用户不受影响
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2' } } as never);
    expect(await enforceRateLimit(req('1.1.1.1', SESSION), rule, l)).toBeNull();
  });

  it('没带会话 cookie 的请求不去解析会话，直接按 IP 计（伪造 cookie 值也只是多一次解析，仍按 IP 或其真实用户计）', async () => {
    jest.mocked(getServerSession).mockClear();
    await enforceRateLimit(req('5.5.5.5'), rule, new FixedWindowLimiter());
    expect(getServerSession).not.toHaveBeenCalled();
    await enforceRateLimit(req('5.5.5.5', { cookie: '__Secure-next-auth.session-token.0=x' }), rule, new FixedWindowLimiter());
    expect(getServerSession).toHaveBeenCalledTimes(1);
  });

  it('不同规则名各算各的，互不占用额度', async () => {
    const l = new FixedWindowLimiter();
    for (let i = 0; i < 4; i++) await enforceRateLimit(req(), rule, l);
    expect(await enforceRateLimit(req(), { ...rule, name: 'other' }, l)).toBeNull();
  });

  it('会话读取失败时按未登录处理，不放行也不抛错', async () => {
    jest.mocked(getServerSession).mockRejectedValue(new Error('boom'));
    const l = new FixedWindowLimiter();
    for (let i = 0; i < 3; i++) expect(await enforceRateLimit(req('1.2.3.4', SESSION), rule, l)).toBeNull();
    expect((await enforceRateLimit(req('1.2.3.4', SESSION), rule, l))!.status).toBe(429);
  });
});

describe('限流响应与规则表', () => {
  it('limitedResponse 全中文', async () => {
    const res = limitedResponse(12);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('12');
    const body = await res.json();
    expect(body.error).toBe('请求过于频繁，请 12 秒后再试');
    expect(body.retryAfterSeconds).toBe(12);
  });

  it('规则表里每条规则都有正的上限与窗口，登录用户额度不低于匿名', () => {
    for (const r of Object.values(PUBLIC_RULES)) {
      expect(r.anonymous).toBeGreaterThan(0);
      expect(r.authenticated).toBeGreaterThanOrEqual(r.anonymous);
      expect(r.windowMs).toBeGreaterThanOrEqual(1000);
    }
  });
});
