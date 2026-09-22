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
        // 有效期内只允许续费同一方案。原来到账时一律「把新方案的时长接在旧到期日之后，
        // 并立刻切到新方案」：专业版用户买一个月全能版，剩余的专业版时长全部按全能版计；
        // 全能版用户误买专业版，剩余的全能版立刻降成专业版。
        const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
        const activePaid = current && current.plan !== 'FREE' && current.planExpireAt && current.planExpireAt > new Date();
        if (activePaid && current.plan !== plan) {
            return NextResponse.json({
                success: false, error: 'PLAN_CHANGE_NOT_SUPPORTED',
                message: `当前${current.plan}会员有效期至 ${current.planExpireAt!.toISOString().slice(0, 10)}，有效期内暂不支持更换方案；到期后可购买其他方案，或联系客服办理升级`,
            }, { status: 409 });
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
