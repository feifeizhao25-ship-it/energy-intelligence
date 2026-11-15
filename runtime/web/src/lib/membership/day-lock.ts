import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sameShanghaiDay } from './day';

const CLEARED = {
  dailyAiCalls: 0,
  dailyCalculations: 0,
  dailyResourceQueries: 0,
  dailyPaperSearches: 0,
  dailyDiagnoses: 0,
};

/** 同一用户的跨天重置和次数累加放在一把事务锁里，避免一个功能把另一个功能刚记下的次数清掉。 */
export async function withDailyLock<T>(userId: string, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`daily:${userId}`}, 0))`;
    return run(tx);
  }, { maxWait: 10000, timeout: 10000 });
}

export async function resetDailyCountersIfNeeded(tx: Prisma.TransactionClient, userId: string, lastResetAt: Date, now: Date) {
  if (sameShanghaiDay(new Date(lastResetAt), now)) return false;
  await tx.user.update({ where: { id: userId }, data: { ...CLEARED, lastResetAt: now } });
  return true;
}
