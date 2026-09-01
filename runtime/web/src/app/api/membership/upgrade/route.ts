import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { Plan } from '@/lib/membership/plans';
import { BillingPeriod, canonicalPrice, createAlipayPagePayUrl } from '@/lib/payments/alipay';

const PAID_PLANS: ReadonlySet<Plan> = new Set<Plan>(
    Object.values(Plan).filter((plan) => plan !== Plan.FREE),
);

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    try {
        const body = await request.json() as { plan?: string; billingPeriod?: string };
        const plan = String(body.plan || '').toUpperCase() as Plan;
        const billingPeriod = body.billingPeriod as BillingPeriod;
        if (!PAID_PLANS.has(plan) || !['monthly', 'yearly'].includes(billingPeriod)) {
            return NextResponse.json({ success: false, error: 'INVALID_PLAN', message: '会员方案或周期无效' }, { status: 400 });
        }
        const amount = canonicalPrice(plan, billingPeriod);
        const orderNo = `ENE${Date.now()}${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
        const paymentUrl = createAlipayPagePayUrl({ orderNo, plan, billingPeriod, amount });
        await prisma.payment.create({ data: {
            orderNo, userId: session.user.id, plan, billingPeriod, amount,
            currency: 'CNY', status: 'pending', paymentMethod: 'alipay',
            description: `${plan}-${billingPeriod}`,
        } });
        return NextResponse.json({ success: true, orderNo, amount: amount.toFixed(2), paymentUrl });
    } catch (error) {
        const message = error instanceof Error ? error.message : '支付订单创建失败';
        return NextResponse.json({ success: false, error: 'PAYMENT_CREATE_FAILED', message }, { status: 503 });
    }
}
