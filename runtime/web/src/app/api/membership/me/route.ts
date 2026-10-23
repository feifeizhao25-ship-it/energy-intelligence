import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { startOfShanghaiDay, nextShanghaiMidnight } from '@/lib/membership/day';

import { encodePaymentCursor, paymentBoundary } from '@/lib/membership/payment-cursor';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }

    const rawPage = request ? new URL(request.url).searchParams.get('paymentPage') ?? '1' : '1';
    if (!/^[1-9]\d*$/.test(rawPage) || Number(rawPage) > 1000000) {
        return NextResponse.json({ success: false, message: '付款记录页码无效' }, { status: 400 });
    }
    const rawCursor = request ? new URL(request.url).searchParams.get('paymentCursor') : null;
    let boundary;
    try { boundary = paymentBoundary(rawCursor, session.user.id); } catch {
        return NextResponse.json({ success: false, message: '付款记录游标无效，请刷新页面' }, { status: 400 });
    }
    const page = Number(rawPage);
    const pageSize = 20;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true, name: true, email: true, plan: true, planExpireAt: true,
            dailyAiCalls: true, dailyResourceQueries: true, dailyCalculations: true,
            dailyPaperSearches: true, dailyDiagnoses: true, lastResetAt: true, projectCount: true,
            paperCount: true, stationCount: true, folderCount: true,
            subscription: {
                select: {
                    status: true, endDate: true, autoRenew: true,
                    scheduledPlan: true, scheduledFromPlan: true, scheduledEffectiveAt: true,
                    payments: {
                        where: { status: 'completed', ...boundary }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                        skip: rawCursor === null ? (page - 1) * pageSize : 0, take: pageSize + 1,
                        select: { id: true, orderNo: true, amount: true, currency: true, paymentMethod: true, description: true, paidAt: true, createdAt: true },
                    },
                },
            },
        },
    });

    if (!user) {
        return NextResponse.json({ success: false, error: 'NOT_FOUND', message: '用户不存在' }, { status: 404 });
    }
    const rows = user.subscription?.payments ?? [];
    const nextCursor = rows.length > pageSize ? encodePaymentCursor(session.user.id, rows[pageSize - 1]) : null;
    const now = new Date();
    // Display the same Beijing-day usage as the atomic consumption service.
    // Reading the page must not mutate counters or race with a calculation.
    const newDay = user.lastResetAt < startOfShanghaiDay(now);
    return NextResponse.json({ success: true, data: {
        ...user,
        subscription: user.subscription ? { ...user.subscription,
            payments: user.subscription.payments.slice(0, pageSize) } : null,
        paymentPagination: { page, nextCursor, nextPage: (user.subscription?.payments.length ?? 0) > pageSize ? page + 1 : null },
        effectivePlan: effectivePlan(user.plan, user.planExpireAt, now),
        nextResetAt: nextShanghaiMidnight(now).toISOString(),
        ...(newDay ? { dailyAiCalls: 0, dailyResourceQueries: 0, dailyCalculations: 0,
            dailyPaperSearches: 0, dailyDiagnoses: 0 } : {}),
    } });
}
