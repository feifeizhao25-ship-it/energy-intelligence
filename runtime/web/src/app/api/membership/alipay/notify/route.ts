import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyAlipayCallback } from '@/lib/payments/alipay';

const text = (body: string, status = 200) => new Response(body, {
  status, headers: { 'content-type': 'text/plain; charset=utf-8' },
});

function expiryFrom(base: Date, period: string): Date {
  const result = new Date(base);
  if (period === 'yearly') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  try {
    if (!verifyAlipayCallback(params)) return text('failure', 400);
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status)) return text('success');
    const totalAmount = Number(params.total_amount);
    if (!Number.isFinite(totalAmount) || !params.out_trade_no || !params.trade_no) return text('failure', 400);
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { orderNo: params.out_trade_no } });
      if (!payment || payment.paymentMethod !== 'alipay' || Number(payment.amount) !== totalAmount) throw new Error('ORDER_MISMATCH');
      if (payment.status === 'completed') {
        if (payment.transactionId !== params.trade_no) throw new Error('TRADE_CONFLICT');
        return;
      }
      const duplicate = await tx.payment.findUnique({ where: { transactionId: params.trade_no } });
      if (duplicate) throw new Error('TRADE_CONFLICT');
      const existing = await tx.subscription.findUnique({ where: { userId: payment.userId } });
      const now = new Date();
      const base = existing?.endDate && existing.endDate > now ? existing.endDate : now;
      const subscription = await tx.subscription.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, plan: payment.plan, status: 'ACTIVE', startDate: now, endDate: expiryFrom(base, payment.billingPeriod), autoRenew: false },
        update: { plan: payment.plan, status: 'ACTIVE', endDate: expiryFrom(base, payment.billingPeriod) },
      });
      await tx.user.update({ where: { id: payment.userId }, data: { plan: payment.plan, planExpireAt: subscription.endDate } });
      await tx.payment.update({
        where: { id: payment.id },
        data: { subscriptionId: subscription.id, status: 'completed', transactionId: params.trade_no, paidAt: now },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return text('success');
  } catch {
    return text('failure', 400);
  }
}
