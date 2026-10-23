import { prisma } from "@/lib/prisma";
import { resetDailyCountersIfNeeded, withDailyLock } from "./day-lock";

const USAGE_COLUMN = {
    calculation: "dailyCalculations",
} as const;

/**
 * 给某一项每日计数加一。跨天时先在同一把锁里清零，再累加，
 * 这样和 AI 次数扣减同时发生时不会互相覆盖。
 */
export async function incrementUsage(userId: string, feature: keyof typeof USAGE_COLUMN) {
    const column = USAGE_COLUMN[feature];
    await withDailyLock(userId, async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { lastResetAt: true } });
        if (!user) return;
        await resetDailyCountersIfNeeded(tx, userId, user.lastResetAt, new Date());
        await tx.user.update({ where: { id: userId }, data: { [column]: { increment: 1 } } });
    });
}

/**
 * 记录详细的使用日志
 */
export async function logUsage(userId: string, feature: string, metadata?: any) {
    await prisma.usageLog.create({
        data: {
            userId,
            type: feature.toUpperCase(),
            metadata: metadata || {},
        }
    });
}
