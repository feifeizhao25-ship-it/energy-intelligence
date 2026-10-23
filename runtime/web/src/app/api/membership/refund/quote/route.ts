import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { refundQuote } from '@/lib/membership/billing-rules';

export const dynamic = 'force-dynamic';

const CLIENT_AMOUNT = ['amount', 'paidAmount', 'paid_amount_cny', 'refundAmount'];

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    let body: Record<string, unknown>;
    try {
        const parsed = await request.json();
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad');
        body = parsed as Record<string, unknown>;
    } catch {
        return NextResponse.json({ success: false, message: '请求参数无效' }, { status: 400 });
    }
    if (CLIENT_AMOUNT.some((key) => body[key] != null)) {
        return NextResponse.json({ success: false, message: '退款金额以已支付订单为准，不能由请求自行填写' }, { status: 400 });
    }
    const orderNo = typeof body.orderNo === 'string' ? body.orderNo.trim() : '';
    if (!orderNo) {
        return NextResponse.json({ success: false, message: '请提供订单号' }, { status: 400 });
    }
    const payment = await prisma.payment.findFirst({
        where: { orderNo, userId: session.user.id },
    });
    if (!payment) {
        return NextResponse.json({ success: false, message: '找不到这笔订单' }, { status: 404 });
    }
    if (payment.status !== 'completed' || !payment.serviceStart || !payment.serviceEnd) {
        return NextResponse.json({
            success: false,
            message: '这笔订单还不能自动测算退款，请财务按支付渠道记录人工核对',
        }, { status: 409 });
    }
    try {
        const quote = refundQuote(String(payment.amount), payment.serviceStart, payment.serviceEnd, new Date());
        return NextResponse.json({ success: true, orderNo: payment.orderNo, ...quote });
    } catch {
        return NextResponse.json({ success: false, message: '这笔订单的金额或服务周期无法测算' }, { status: 409 });
    }
}
