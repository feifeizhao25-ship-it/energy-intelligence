import { NextRequest, NextResponse } from 'next/server';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findFirst: jest.fn() } } }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { withMembershipCheck, type Member } from './middleware';
import { Plan } from './plans';
import type { DailyStore } from './daily-usage';

const req = () => new NextRequest('http://x/api/calculator/wind', { method: 'POST' });

function store(counter = { n: 0 }, plan = 'PRO'): { s: DailyStore; counter: { n: number } } {
  const s: DailyStore = {
    load: async () => ({ plan, planExpireAt: new Date('2099-01-01'), lastResetAt: new Date() }),
    resetIfNewDay: async () => undefined,
    takeIfBelow: async (_u, _c, limit) => { if (counter.n < limit) { counter.n++; return true; } return false; },
    take: async () => { counter.n++; },
    release: async () => { counter.n = Math.max(0, counter.n - 1); },
  };
  return { s, counter };
}

describe('withMembershipCheck：真实会话接入（原来 getCurrentUser 写死返回 null，所有人永远 401）', () => {
  beforeEach(() => jest.resetAllMocks());

  it('已登录的专业版用户能通过并拿到自己的 id 与有效会员档', async () => {
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } } as never);
    jest.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'u1', plan: 'PRO', planExpireAt: new Date('2099-01-01') } as never);
    const { s } = store();
    let seen: Member | null = null;
    const res = await withMembershipCheck(req(), { feature: 'wind_calculation', usageType: 'calculation' },
      async (u) => { seen = u; return NextResponse.json({ ok: true }); }, { store: s });
    expect(res.status).toBe(200);
    expect(seen).toEqual({ id: 'u1', plan: Plan.PRO });
  });

  it('没登录：401 中文提示，业务不执行', async () => {
    jest.mocked(getServerSession).mockResolvedValue(null);
    const handler = jest.fn();
    const res = await withMembershipCheck(req(), { usageType: 'calculation' }, handler);
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('请先登录');
    expect(handler).not.toHaveBeenCalled();
  });

  it('会话在、账号已注销：401', async () => {
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'gone' } } as never);
    jest.mocked(prisma.user.findFirst).mockResolvedValue(null);
    expect((await withMembershipCheck(req(), {}, jest.fn())).status).toBe(401);
  });

  it('免费版调用风电测算：403 且业务不执行、不扣额度', async () => {
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2' } } as never);
    jest.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'u2', plan: 'FREE', planExpireAt: null } as never);
    const { s, counter } = store({ n: 0 }, 'FREE');
    const handler = jest.fn();
    const res = await withMembershipCheck(req(), { feature: 'wind_calculation', usageType: 'calculation' }, handler, { store: s });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FEATURE_NOT_AVAILABLE');
    expect(body.message).toMatch(/升级会员/);
    expect(handler).not.toHaveBeenCalled();
    expect(counter.n).toBe(0);
  });

  it('会员过期后按免费版：专业版功能 403', async () => {
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u3' } } as never);
    jest.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'u3', plan: 'PRO', planExpireAt: new Date('2020-01-01') } as never);
    const res = await withMembershipCheck(req(), { feature: 'wind_calculation' }, jest.fn());
    expect(res.status).toBe(403);
  });

  it('额度用完：429 中文提示，含重置时间，业务不执行', async () => {
    const member = async () => ({ id: 'u4', plan: Plan.FREE });
    const { s } = store({ n: 2 }, 'FREE');
    const handler = jest.fn();
    const res = await withMembershipCheck(req(), { usageType: 'calculation' }, handler, { member, store: s });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toMatch(/今日收益测算次数已用完（2 次）/);
    expect(new Date(body.resetAt).getTime()).toBeGreaterThan(Date.now());
    expect(handler).not.toHaveBeenCalled();
  });

  it('业务返回错误（如参数不合法）不占用户额度；抛异常也退还', async () => {
    const member = async () => ({ id: 'u5', plan: Plan.FREE });
    const { s, counter } = store({ n: 0 }, 'FREE');
    await withMembershipCheck(req(), { usageType: 'calculation' }, async () => NextResponse.json({}, { status: 400 }), { member, store: s });
    expect(counter.n).toBe(0);
    await expect(withMembershipCheck(req(), { usageType: 'calculation' }, async () => { throw new Error('x'); }, { member, store: s })).rejects.toThrow();
    expect(counter.n).toBe(0);
    await withMembershipCheck(req(), { usageType: 'calculation' }, async () => NextResponse.json({ ok: 1 }), { member, store: s });
    expect(counter.n).toBe(1);
  });
});
