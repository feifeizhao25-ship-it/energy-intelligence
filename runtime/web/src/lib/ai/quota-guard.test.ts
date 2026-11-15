import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// 纯逻辑测试：不实例化真实 Prisma 客户端（会通过 globalThis 泄漏到同进程的其他测试文件）
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
import { consumeAiCall, refundAiCall, trackAiQuota, type QuotaStore, type QuotaUser } from './quota-guard';

function store(user: QuotaUser | null) {
  const state = { user, calls: 0 };
  const s: QuotaStore = {
    load: async () => state.user && { ...state.user },
    resetAndTake: async (_id, now, previousReset) => {
      if (state.user!.lastResetAt.getTime() !== previousReset.getTime()) return false;
      state.user = { ...state.user!, dailyAiCalls: 1, lastResetAt: now };
      return true;
    },
    takeIfBelow: async (_id, limit) => {
      if (state.user!.dailyAiCalls >= limit) return false;
      state.user = { ...state.user!, dailyAiCalls: state.user!.dailyAiCalls + 1 };
      return true;
    },
    take: async () => { state.user = { ...state.user!, dailyAiCalls: state.user!.dailyAiCalls + 1 }; return true; },
    release: async () => {
      if (!state.user || state.user.dailyAiCalls <= 0) return;
      state.user = { ...state.user, dailyAiCalls: state.user.dailyAiCalls - 1 };
    },
  };
  return { s, state };
}

const now = new Date('2026-09-22T10:00:00');

describe('AI 次数门禁', () => {
  it('免费档每天 5 次，第 6 次被拒', async () => {
    const { s } = store({ plan: 'FREE', planExpireAt: null, dailyAiCalls: 0, lastResetAt: now });
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await consumeAiCall(s, 'u', now)).ok);
    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it('跨天重置；过期会员按免费档', async () => {
    const { s, state } = store({ plan: 'FULL', planExpireAt: new Date('2026-09-01'), dailyAiCalls: 3, lastResetAt: new Date('2026-09-21T10:00:00') });
    const r = await consumeAiCall(s, 'u', now);
    expect(r).toMatchObject({ ok: true, plan: 'FREE', limit: 5 });
    expect(state.user!.dailyAiCalls).toBe(1);
  });

  it('用户不存在不放行', async () => {
    expect((await consumeAiCall(store(null).s, 'u', now)).ok).toBe(false);
  });

  it('模型调用失败时退还已扣次数，再退也不会变成负数', async () => {
    const { s, state } = store({ plan: 'FREE', planExpireAt: null, dailyAiCalls: 0, lastResetAt: now });
    expect((await consumeAiCall(s, 'u', now)).ok).toBe(true);
    expect(state.user!.dailyAiCalls).toBe(1);
    await refundAiCall('u', s);
    await refundAiCall('u', s);
    expect(state.user!.dailyAiCalls).toBe(0);
  });

  it('同一次调用的退还只执行一次，成功后不再退', async () => {
    const { s, state } = store({ plan: 'FREE', planExpireAt: null, dailyAiCalls: 2, lastResetAt: now });
    const tracked = trackAiQuota('u', s);
    await Promise.all([tracked.refund(), tracked.refund()]);
    expect(state.user!.dailyAiCalls).toBe(1);
    const succeeded = trackAiQuota('u', s);
    succeeded.settle();
    await succeeded.refund();
    expect(state.user!.dailyAiCalls).toBe(1);
  });

  it('所有调用模型的接口都经过门禁', () => {
    const root = join(__dirname, '..', '..');
    for (const f of ['app/api/chat/route.ts', 'app/api/papers/ai/route.ts', 'app/api/papers/research-assistant/route.ts',
      'app/api/papers/analyze-search/route.ts', 'app/api/papers/chat/route.ts', 'app/api/calculator/analysis/route.ts']) {
      expect([f, readFileSync(join(root, f), 'utf8').includes('await requireAiQuota()')]).toEqual([f, true]);
    }
  });
});


it('跨天 30 个并发请求只放行免费档 5 次，不重复重置', async () => {
  const { s, state } = store({ plan: 'FREE', planExpireAt: null, dailyAiCalls: 3, lastResetAt: new Date('2026-09-21T10:00:00') });
  const results = await Promise.all(Array.from({ length: 30 }, () => consumeAiCall(s, 'u', now)));
  expect(results.filter((r) => r.ok)).toHaveLength(5);
  expect(state.user!.dailyAiCalls).toBe(5);
});
