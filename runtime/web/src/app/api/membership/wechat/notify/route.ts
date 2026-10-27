import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptResource, readWechatConfig, verifyNotifySignature } from '@/lib/payments/wechat';

function expiryFrom(base: Date, period: string): Date {
  const result = new Date(base);
  if (period === 'yearly') result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const config = readWechatConfig();
  if (!config) return Response.json({ code: 'WECHAT_PAY_NOT_CONFIGURED', message: '微信支付未配置' }, { status: 503 });
  const timestamp = request.headers.get('wechatpay-timestamp') || '';
  const nonce = request.headers.get('wechatpay-nonce') || '';
  const signature = request.headers.get('wechatpay-signature') || '';
  if (!verifyNotifySignature(config, timestamp, nonce, raw, signature)) {
    return Response.json({ code: 'FAIL', message: '验签失败' }, { status: 400 });
  }
  let resource: ReturnType<typeof decryptResource>;
  try {
    const body = JSON.parse(raw) as { resource?: { ciphertext: string; nonce: string; associated_data?: string } };
    if (!body.resource) throw new Error('missing');
    resource = decryptResource(config.apiV3Key, body.resource);
  } catch {
    return Response.json({ code: 'FAIL', message: '通知无法解密' }, { status: 400 });
  }
  if (resource.trade_state !== 'SUCCESS') return Response.json({ code: 'SUCCESS', message: '已忽略未成功的通知' });
  const amount = resource.amount.total / 100;
  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { orderNo: resource.out_trade_no } });
      if (!payment || payment.paymentMethod !== 'wechat' || Number(payment.amount) !== amount) throw new Error('ORDER_MISMATCH');
      if (payment.status === 'completed') {
        if (payment.transactionId !== resource.transaction_id) throw new Error('TRADE_CONFLICT');
        return;
      }
      const duplicate = await tx.payment.findUnique({ where: { transactionId: resource.transaction_id } });
      if (duplicate) throw new Error('TRADE_CONFLICT');
      const existing = await tx.subscription.findUnique({ where: { userId: payment.userId } });
      const now = new Date();
      const base = existing?.endDate && existing.endDate > now && existing.plan === payment.plan ? existing.endDate : now;
      const serviceEnd = expiryFrom(base, payment.billingPeriod);
      const subscription = await tx.subscription.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, plan: payment.plan, status: 'ACTIVE', startDate: now, endDate: serviceEnd, autoRenew: false },
        update: { plan: payment.plan, status: 'ACTIVE', endDate: serviceEnd, scheduledPlan: null, scheduledFromPlan: null, scheduledEffectiveAt: null },
      });
      await tx.user.update({ where: { id: payment.userId }, data: { plan: payment.plan, planExpireAt: subscription.endDate } });
      await tx.payment.update({
        where: { id: payment.id },
        data: { subscriptionId: subscription.id, status: 'completed', transactionId: resource.transaction_id, paidAt: now, serviceStart: base, serviceEnd },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return Response.json({ code: 'FAIL', message: '订单与通知不一致' }, { status: 400 });
  }
  return Response.json({ code: 'SUCCESS', message: '成功' });
}
