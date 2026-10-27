import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reconcilePayments } from '@/lib/payments/reconcile';

export async function POST(req: NextRequest) {
    const secret = process.env.CRON_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-key');
    if (!secret || req.headers.get('x-cron-secret') !== secret) {
        return NextResponse.json({ error: '无权执行对账' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const bill = Array.isArray(body?.bill) ? body.bill : [];
    const payments = await prisma.payment.findMany({ where: { status: 'completed' }, select: { orderNo: true, amount: true, status: true } });
    const result = reconcilePayments(
        payments.map((row) => ({ orderNo: row.orderNo, amount: Number(row.amount), status: row.status })),
        bill.map((row: { orderNo?: string; amount?: number; status?: string }) => ({
            orderNo: String(row.orderNo || ''),
            amount: Number(row.amount),
            status: String(row.status || ''),
        })),
    );
    if (result.alert && process.env.NENGJIAN_WECOM_ROBOT_KEY) {
        await fetch(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(process.env.NENGJIAN_WECOM_ROBOT_KEY)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ msgtype: 'text', text: { content: `支付对账差额 ${result.diff} 元，请人工核对。` } }),
        }).catch(() => undefined);
    }
    return NextResponse.json({ success: true, data: result }, { status: result.alert ? 409 : 200 });
}
