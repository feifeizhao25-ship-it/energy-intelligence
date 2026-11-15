import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decideScheduledDowngrade } from '@/lib/membership/billing-rules';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-key');
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, message: '请先登录' }, { status: 401 });
    }
    const now = new Date();
    const due = await prisma.subscription.findMany({
        where: { scheduledPlan: { not: null }, endDate: { lte: now } },
        orderBy: { id: 'asc' },
        take: 200,
        include: { user: { select: { id: true, plan: true } } },
    });
    const counts = { applied: 0, cancelled: 0, skipped: 0 };
    for (const row of due) {
        const decision = decideScheduledDowngrade({
            storedPlan: row.user.plan,
            scheduledPlan: row.scheduledPlan,
            scheduledFromPlan: row.scheduledFromPlan,
            scheduledEffectiveAt: row.scheduledEffectiveAt,
            endDate: row.endDate,
            now,
        });
        if (decision.action === 'wait') {
            counts.skipped += 1;
            continue;
        }
        if (decision.action === 'cancel') {
            const cleared = await prisma.subscription.updateMany({
                where: {
                    id: row.id,
                    scheduledPlan: row.scheduledPlan,
                    scheduledFromPlan: row.scheduledFromPlan,
                    scheduledEffectiveAt: row.scheduledEffectiveAt,
                    endDate: row.endDate,
                },
                data: { scheduledPlan: null, scheduledFromPlan: null, scheduledEffectiveAt: null },
            });
            if (cleared.count === 1) counts.cancelled += 1;
            else counts.skipped += 1;
            continue;
        }
        const switched = await prisma.$transaction(async (tx) => {
            const subscription = await tx.subscription.updateMany({
                where: {
                    id: row.id,
                    plan: row.scheduledFromPlan as never,
                    scheduledPlan: row.scheduledPlan,
                    scheduledFromPlan: row.scheduledFromPlan,
                    scheduledEffectiveAt: row.scheduledEffectiveAt,
                    endDate: row.endDate,
                },
                data: {
                    plan: decision.plan as never,
                    scheduledPlan: null,
                    scheduledFromPlan: null,
                    scheduledEffectiveAt: null,
                },
            });
            if (subscription.count !== 1) return false;
            const user = await tx.user.updateMany({
                where: { id: row.userId, plan: row.scheduledFromPlan as never },
                data: { plan: decision.plan as never },
            });
            if (user.count !== 1) throw new Error('会员档位在切换时已变化');
            return true;
        }).catch(() => false);
        if (switched) counts.applied += 1;
        else counts.skipped += 1;
    }
    return NextResponse.json({ success: true, ...counts });
}
