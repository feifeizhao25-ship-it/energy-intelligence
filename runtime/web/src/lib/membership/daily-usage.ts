import { prisma } from '@/lib/prisma';
import { Plan, USAGE_LIMITS } from './plans';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { sameShanghaiDay, startOfShanghaiDay } from './day';

/**
 * 每日额度的服务端扣减：会员档取自数据库（不信会话里的值），扣减用条件更新，
 * 并发请求不会越过上限；跨天重置也是条件更新，两个并发的「当天首个请求」不会互相覆盖计数。
 */

export type DailyFeature = 'ai_chat' | 'resource_query' | 'calculation' | 'paper_search' | 'diagnosis';

export const DAILY_COLUMN = {
  ai_chat: 'dailyAiCalls',
  resource_query: 'dailyResourceQueries',
  calculation: 'dailyCalculations',
  paper_search: 'dailyPaperSearches',
  diagnosis: 'dailyDiagnoses',
} as const satisfies Record<DailyFeature, string>;

export type DailyColumn = (typeof DAILY_COLUMN)[DailyFeature];

export const DAILY_FEATURE_NAME: Record<DailyFeature, string> = {
  ai_chat: 'AI 对话', resource_query: '资源查询', calculation: '收益测算', paper_search: '文献检索', diagnosis: '运维诊断',
};

export interface DailyUser {
  plan: string;
  planExpireAt: Date | null;
  lastResetAt: Date;
}

export interface DailyStore {
  load(userId: string): Promise<DailyUser | null>;
  /** 当天首个请求：把所有计数清零并记下重置时刻。只在 lastResetAt 早于今天时生效。 */
  resetIfNewDay(userId: string, now: Date): Promise<void>;
  /** 计数小于 limit 才加一，返回是否扣到。 */
  takeIfBelow(userId: string, column: DailyColumn, limit: number): Promise<boolean>;
  take(userId: string, column: DailyColumn): Promise<void>;
  release(userId: string, column: DailyColumn): Promise<void>;
}

export const prismaDailyStore: DailyStore = {
  load: (userId) => prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { plan: true, planExpireAt: true, lastResetAt: true },
  }),
  resetIfNewDay: async (userId, now) => {
    await prisma.user.updateMany({
      where: { id: userId, lastResetAt: { lt: startOfShanghaiDay(now) } },
      data: { dailyAiCalls: 0, dailyCalculations: 0, dailyResourceQueries: 0, dailyPaperSearches: 0, dailyDiagnoses: 0, lastResetAt: now },
    });
  },
  takeIfBelow: async (userId, column, limit) => {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, [column]: { lt: limit } },
      data: { [column]: { increment: 1 } },
    });
    return count === 1;
  },
  take: async (userId, column) => {
    await prisma.user.update({ where: { id: userId }, data: { [column]: { increment: 1 } } });
  },
  release: async (userId, column) => {
    await prisma.user.updateMany({ where: { id: userId, [column]: { gt: 0 } }, data: { [column]: { decrement: 1 } } });
  },
};

export interface DailyResult {
  ok: boolean;
  plan: Plan;
  limit: number; // -1 = 不限
  reason?: 'NO_USER' | 'LIMIT';
}

export async function consumeDaily(
  feature: DailyFeature,
  userId: string,
  store: DailyStore = prismaDailyStore,
  now: Date = new Date(),
): Promise<DailyResult> {
  const user = await store.load(userId);
  if (!user) return { ok: false, plan: Plan.FREE, limit: 0, reason: 'NO_USER' };
  const plan = effectivePlan(user.plan, user.planExpireAt, now) as Plan;
  const rawLimit = (USAGE_LIMITS[plan] ?? USAGE_LIMITS.FREE)[feature];
  if (!sameShanghaiDay(new Date(user.lastResetAt), now)) await store.resetIfNewDay(userId, now);
  const column = DAILY_COLUMN[feature];
  if (rawLimit === Infinity) {
    await store.take(userId, column);
    return { ok: true, plan, limit: -1 };
  }
  const taken = rawLimit > 0 && (await store.takeIfBelow(userId, column, rawLimit));
  return { ok: taken, plan, limit: rawLimit, reason: taken ? undefined : 'LIMIT' };
}

export function refundDaily(feature: DailyFeature, userId: string, store: DailyStore = prismaDailyStore) {
  return store.release(userId, DAILY_COLUMN[feature]);
}
