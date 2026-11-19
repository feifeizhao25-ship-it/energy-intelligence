/**
 * 周漏斗的数据库读取：一个只读事务（SET TRANSACTION READ ONLY + 5 秒语句超时），只做查询。
 * 只读 users、payments、subscriptions、signup_source_events 四张表，只取统计要用的列。
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import {
    buildReport,
    FunnelReport,
    FunnelSource,
    payerDigest,
    SOURCE_TABLE,
    yuanToFen,
} from './weekly-funnel';

type Tx = Prisma.TransactionClient;

/** users."createdAt" 是不带时区的 UTC 时间；原生查询里把参数明确换成 UTC，不受会话时区影响。 */
function utc(date: Date): string {
    return date.toISOString();
}

export function prismaFunnelSource(tx: Tx): FunnelSource {
    let sourceTableExists: boolean | null = null;
    return {
        countSignups(start, end) {
            return tx.user.count({ where: { createdAt: { gte: start, lt: end } } });
        },
        async completedPayments(before) {
            const rows = await tx.payment.findMany({
                where: { status: 'completed', currency: 'CNY', paidAt: { not: null, lt: before } },
                select: { id: true, userId: true, amount: true, paidAt: true },
            });
            return rows.map((r) => ({
                payer: payerDigest(r.userId),
                key: r.id,
                paidAt: r.paidAt as Date,
                amountFen: yuanToFen(r.amount),
            }));
        },
        async subscriptionEndDates(from, to) {
            const rows = await tx.subscription.findMany({
                where: { endDate: { gte: from, lt: to } },
                select: { endDate: true },
            });
            return rows.map((r) => r.endDate);
        },
        async signupSources(start, end) {
            if (sourceTableExists === null) {
                const found = await tx.$queryRaw<{ present: boolean }[]>`
                    SELECT to_regclass(${'public.' + SOURCE_TABLE}) IS NOT NULL AS present`;
                sourceTableExists = Boolean(found[0]?.present);
            }
            if (!sourceTableExists) return null;
            const rows = await tx.$queryRaw<{ source: string; n: number }[]>`
                SELECT s."source" AS source, COUNT(*)::int AS n
                FROM "signup_source_events" s
                JOIN "users" u ON u."id" = s."userId"
                WHERE u."createdAt" >= (${utc(start)}::timestamptz AT TIME ZONE 'UTC')
                  AND u."createdAt" <  (${utc(end)}::timestamptz AT TIME ZONE 'UTC')
                GROUP BY s."source"
                ORDER BY s."source"`;
            const out: Record<string, number> = {};
            for (const row of rows) out[String(row.source)] = Number(row.n);
            return out;
        },
    };
}

export async function reportFromDatabase(
    prisma: PrismaClient,
    params: { weekStart: string | null; weeks: string | null },
    now: Date = new Date(),
): Promise<FunnelReport> {
    return prisma.$transaction(
        async (tx) => {
            await tx.$executeRaw`SET TRANSACTION READ ONLY`;
            await tx.$executeRaw`SET LOCAL statement_timeout = 5000`;
            return buildReport(prismaFunnelSource(tx), params, now);
        },
        { maxWait: 5000, timeout: 20000 },
    );
}
