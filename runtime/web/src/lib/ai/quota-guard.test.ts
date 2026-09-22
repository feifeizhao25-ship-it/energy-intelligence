import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// 纯逻辑测试：不实例化真实 Prisma 客户端（会通过 globalThis 泄漏到同进程的其他测试文件）
jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
import { consumeAiCall, type QuotaStore, type QuotaUser } from './quota-guard';

function store(user: QuotaUser | null) {
  const state = { user, calls: 0 };
  const s: QuotaStore = {
    load: async () => state.user && { ...state.user },
    resetAndTake: async (_id, now) => { state.user = { ...state.user!, dailyAiCalls: 1, lastResetAt: now }; },
    takeIfBelow: async (_id, limit) => {
      if (state.user!.dailyAiCalls >= limit) return false;
      state.user = { ...state.user!, dailyAiCalls: state.user!.dailyAiCalls + 1 };
      return true;
    },
    take: async () => { state.user = { ...state.user!, dailyAiCalls: state.user!.dailyAiCalls + 1 }; },
  };
  return { s, state };
}

const now = new Date('2026-09-22T10:00:00');

describe('AI 次数门禁', () => {
  it('免费档每天 3 次，第 4 次被拒', async () => {
    const { s } = store({ plan: 'FREE', planExpireAt: null, dailyAiCalls: 0, lastResetAt: now });
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await consumeAiCall(s, 'u', now)).ok);
    expect(results).toEqual([true, true, true, false]);
  });

  it('跨天重置；过期会员按免费档', async () => {
    const { s, state } = store({ plan: 'FULL', planExpireAt: new Date('2026-09-01'), dailyAiCalls: 3, lastResetAt: new Date('2026-09-21T10:00:00') });
    const r = await consumeAiCall(s, 'u', now);
    expect(r).toMatchObject({ ok: true, plan: 'FREE', limit: 3 });
    expect(state.user!.dailyAiCalls).toBe(1);
  });

  it('用户不存在不放行', async () => {
    expect((await consumeAiCall(store(null).s, 'u', now)).ok).toBe(false);
  });

  it('所有调用模型的接口都经过门禁', () => {
    const root = join(__dirname, '..', '..');
    for (const f of ['app/api/chat/route.ts', 'app/api/papers/ai/route.ts', 'app/api/papers/research-assistant/route.ts',
      'app/api/papers/analyze-search/route.ts', 'app/api/papers/chat/route.ts', 'app/api/calculator/analysis/route.ts']) {
      expect([f, readFileSync(join(root, f), 'utf8').includes('await requireAiQuota()')]).toEqual([f, true]);
    }
  });
});
