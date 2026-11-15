import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { isLowerTier } from '@/lib/membership/billing-rules';
import { effectivePlan } from '@/lib/auth/token-refresh';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    let plan = '';
    try {
        const body = await request.json() as { plan?: unknown };
        plan = typeof body.plan === 'string' ? body.plan.trim().toUpperCase() : '';
    } catch {
        return NextResponse.json({ success: false, message: '请求参数无效' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { subscription: true },
    });
    if (!user) {
        return NextResponse.json({ success: false, message: '用户不存在' }, { status: 404 });
    }
    const now = new Date();
    const active = effectivePlan(user.plan, user.planExpireAt, now) === user.plan && user.plan !== 'FREE';
    const end = user.subscription?.endDate ?? null;
    if (!active || !user.planExpireAt || user.planExpireAt <= now || !user.subscription || !end || end <= now) {
        return NextResponse.json({ success: false, message: '当前没有可降级的有效付费周期' }, { status: 400 });
    }
    if (user.planExpireAt.getTime() !== end.getTime()) {
        return NextResponse.json({ success: false, message: '会员到期时间不一致，请联系客服核对后再降级' }, { status: 409 });
    }
    if (!isLowerTier(user.plan, plan)) {
        return NextResponse.json({ success: false, message: '降级目标必须低于当前档位。升级请联系客服，差价规则尚未定稿' }, { status: 400 });
    }
    await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { scheduledPlan: plan as never, scheduledFromPlan: user.plan, scheduledEffectiveAt: end },
    });
    return NextResponse.json({
        success: true,
        fromPlan: user.plan,
        toPlan: plan,
        effectiveAt: end.toISOString(),
        message: '已登记降级。当前权益保持到到期日，不退差价；到期后改为所选档位，未再付款则按免费版使用。',
    });
}
