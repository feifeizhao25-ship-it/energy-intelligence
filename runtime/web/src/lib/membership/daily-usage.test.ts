jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import { consumeDaily, refundDaily, type DailyStore, type DailyColumn, type DailyUser } from './daily-usage';

function fakeStore(user: DailyUser | null, counters: Partial<Record<DailyColumn, number>> = {}) {
  const c: Record<string, number> = { ...counters };
  const calls: string[] = [];
  const store: DailyStore = {
    load: async () => user,
    resetIfNewDay: async () => { calls.push('reset'); for (const k of Object.keys(c)) c[k] = 0; },
    takeIfBelow: async (_u, col, limit) => { if ((c[col] ?? 0) < limit) { c[col] = (c[col] ?? 0) + 1; return true; } return false; },
    take: async (_u, col) => { c[col] = (c[col] ?? 0) + 1; },
    release: async (_u, col) => { if ((c[col] ?? 0) > 0) c[col] -= 1; },
  };
  return { store, c, calls };
}

const NOW = new Date('2026-09-30T04:00:00Z'); // 北京 12:00
const today = new Date('2026-09-30T01:00:00Z');

describe('每日额度扣减', () => {
  it('免费版每天 2 次测算：第 3 次被拒', async () => {
    const { store } = fakeStore({ plan: 'FREE', planExpireAt: null, lastResetAt: today });
    expect((await consumeDaily('calculation', 'u', store, NOW)).ok).toBe(true);
    expect((await consumeDaily('calculation', 'u', store, NOW)).ok).toBe(true);
    const third = await consumeDaily('calculation', 'u', store, NOW);
    expect(third).toMatchObject({ ok: false, limit: 2, reason: 'LIMIT' });
  });

  it('专业版测算不限次', async () => {
    const { store, c } = fakeStore(
      { plan: 'PRO', planExpireAt: new Date('2027-01-01T00:00:00Z'), lastResetAt: today },
      { dailyCalculations: 500 },
    );
    expect(await consumeDaily('calculation', 'u', store, NOW)).toMatchObject({ ok: true, limit: -1 });
    expect(c.dailyCalculations).toBe(501);
  });

  it('会员已过期按免费版算（库里 plan 还写着 PRO 也一样）', async () => {
    const { store } = fakeStore(
      { plan: 'PRO', planExpireAt: new Date('2026-09-01T00:00:00Z'), lastResetAt: today },
      { dailyCalculations: 2 },
    );
    expect(await consumeDaily('calculation', 'u', store, NOW)).toMatchObject({ ok: false, plan: 'FREE' });
  });

  it('免费版没有运维诊断额度（0 次）', async () => {
    const { store } = fakeStore({ plan: 'FREE', planExpireAt: null, lastResetAt: today });
    expect(await consumeDaily('diagnosis', 'u', store, NOW)).toMatchObject({ ok: false, limit: 0 });
  });

  it('跨天（北京时间）先重置再扣：昨晚用完的额度今天凌晨就恢复', async () => {
    const { store, calls } = fakeStore(
      { plan: 'FREE', planExpireAt: null, lastResetAt: new Date('2026-09-30T15:00:00Z') }, // 北京 9/30 23:00
      { dailyCalculations: 2 },
    );
    const afterMidnight = new Date('2026-09-30T16:30:00Z'); // 北京 10/1 00:30
    expect((await consumeDaily('calculation', 'u', store, afterMidnight)).ok).toBe(true);
    expect(calls).toContain('reset');
  });

  it('同一天不重置', async () => {
    const { store, calls } = fakeStore({ plan: 'FREE', planExpireAt: null, lastResetAt: today });
    await consumeDaily('calculation', 'u', store, NOW);
    expect(calls).not.toContain('reset');
  });

  it('用户不存在（已注销）：拒绝', async () => {
    const { store } = fakeStore(null);
    expect(await consumeDaily('calculation', 'u', store, NOW)).toMatchObject({ ok: false, reason: 'NO_USER' });
  });

  it('退还：业务失败时把扣掉的次数还回去，计数不会变负', async () => {
    const { store, c } = fakeStore({ plan: 'FREE', planExpireAt: null, lastResetAt: today });
    await consumeDaily('calculation', 'u', store, NOW);
    await refundDaily('calculation', 'u', store);
    await refundDaily('calculation', 'u', store);
    expect(c.dailyCalculations).toBe(0);
  });
});
