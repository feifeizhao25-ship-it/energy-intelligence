import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { USAGE_LIMITS } from '@/lib/membership/plans';
import { effectivePlan } from '@/lib/auth/token-refresh';

/**
 * 调用模型前的统一门禁：必须登录，并按服务端记录的会员档扣减每日 AI 次数。
 *
 * 原来：
 * - /api/chat 不登录也能用，登录用户也只「事后记一笔」，从不拦；
 * - /api/papers/ai（正文最长 20 万字）、/api/papers/research-assistant、
 *   /api/papers/analyze-search 完全不校验身份——任何人都能拿站点的模型额度跑任意文本；
 * - 会员档取自会话（上一个提交修掉了伪造，这里仍以库里为准）。
 *
 * 扣减用条件更新：并发请求不会越过上限。
 */

export type AiGuardResult =
  | { ok: true; userId: string; plan: string; remaining: number | null }
  | { ok: false; response: NextResponse };

export interface QuotaUser {
  plan: string;
  planExpireAt: Date | null;
  dailyAiCalls: number;
  lastResetAt: Date;
}

export interface QuotaStore {
  load(userId: string): Promise<QuotaUser | null>;
  resetAndTake(userId: string, now: Date, previousReset: Date): Promise<boolean>;
  takeIfBelow(userId: string, limit: number): Promise<boolean>;
  take(userId: string): Promise<boolean>;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export async function consumeAiCall(store: QuotaStore, userId: string, now = new Date()): Promise<{ ok: boolean; plan: string; limit: number; remaining: number | null }> {
  const user = await store.load(userId);
  if (!user) return { ok: false, plan: 'FREE', limit: 0, remaining: 0 };
  const plan = effectivePlan(user.plan, user.planExpireAt, now) as keyof typeof USAGE_LIMITS;
  const limit = (USAGE_LIMITS[plan] ?? USAGE_LIMITS.FREE).ai_chat;
  if (limit <= 0) return { ok: false, plan, limit, remaining: 0 };
  if (!sameDay(new Date(user.lastResetAt), now)) {
    const reset = await store.resetAndTake(userId, now, user.lastResetAt);
    if (reset) return { ok: true, plan, limit, remaining: Number.isFinite(limit) ? limit - 1 : null };
    // Another request already reset the day. It must still consume its own slot.
  }
  if (!Number.isFinite(limit)) {
    const taken = await store.take(userId);
    return { ok: taken, plan, limit, remaining: null };
  }
  const taken = await store.takeIfBelow(userId, limit);
  return { ok: taken, plan, limit, remaining: taken ? Math.max(0, limit - user.dailyAiCalls - 1) : 0 };
}

export const prismaQuotaStore: QuotaStore = {
  load: (userId) => prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { plan: true, planExpireAt: true, dailyAiCalls: true, lastResetAt: true },
  }),
  resetAndTake: async (userId, now, previousReset) => {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, deletedAt: null, lastResetAt: previousReset },
      data: { dailyAiCalls: 1, dailyCalculations: 0, dailyResourceQueries: 0, dailyPaperSearches: 0, dailyDiagnoses: 0, lastResetAt: now },
    });
    return count === 1;
  },
  takeIfBelow: async (userId, limit) => {
    const { count } = await prisma.user.updateMany({
      where: { id: userId, deletedAt: null, dailyAiCalls: { lt: limit } },
      data: { dailyAiCalls: { increment: 1 } },
    });
    return count === 1;
  },
  take: async (userId) => {
    const { count } = await prisma.user.updateMany({ where: { id: userId, deletedAt: null }, data: { dailyAiCalls: { increment: 1 } } });
    return count === 1;
  },
};

export async function requireAiQuota(store: QuotaStore = prismaQuotaStore): Promise<AiGuardResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录后使用 AI 功能' }, { status: 401 }) };
  }
  const result = await consumeAiCall(store, userId);
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json({
        error: 'AI_QUOTA_EXCEEDED',
        message: result.limit > 0 ? `今日 AI 次数已用完（${result.limit} 次），明天恢复或升级会员` : '当前会员档不含 AI 功能',
        limit: result.limit,
      }, { status: 429 }),
    };
  }
  return { ok: true, userId, plan: result.plan, remaining: result.remaining };
}
