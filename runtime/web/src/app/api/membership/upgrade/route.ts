import { shanghaiDate } from '@/lib/membership/day';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { Plan, PURCHASABLE_PLANS } from '@/lib/membership/plans';
import { BillingPeriod, canonicalPrice, createAlipayPagePayUrl } from '@/lib/payments/alipay';

// 只允许购买在售档位；MAINTENANCE（运维版）已停售，不能新购
const PAID_PLANS: ReadonlySet<Plan> = new Set<Plan>(PURCHASABLE_PLANS);

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
                message: `当前${current.plan}会员有效期至 ${shanghaiDate(current.planExpireAt!)}，有效期内暂不支持更换方案；到期后可购买其他方案，或联系客服办理升级`,
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
        // 原来把 error.message 原样返回：缺配置时用户会看到「支付宝商户配置缺失：ALIPAY_PRIVATE_KEY」，
        // 把环境变量名、内部校验和数据库连接信息都暴露给浏览器。细节只写服务端日志。
        console.error('[membership/upgrade] 创建支付订单失败：', error);
        return NextResponse.json({
            success: false, error: 'PAYMENT_CREATE_FAILED',
            message: '支付通道暂时不可用，请稍后再试；如持续失败请联系客服',
        }, { status: 503 });
    }
}
