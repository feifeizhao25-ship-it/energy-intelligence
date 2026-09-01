import 'server-only';
import { createSign, createVerify } from 'node:crypto';
import { PLAN_DETAILS, Plan } from '@/lib/membership/plans';

const PROD_GATEWAY = 'https://openapi.alipay.com/gateway.do';
const SANDBOX_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';

export type BillingPeriod = 'monthly' | 'yearly';

function required(name: string): string {
  const value = process.env[name]?.replace(/\\n/g, '\n').trim();
  if (!value) throw new Error(`支付宝商户配置缺失：${name}`);
  return value;
}

export function canonicalAlipayParams(
  params: Record<string, string>, callback = false,
): string {
  return Object.keys(params).sort().filter((key) =>
    key !== 'sign' && (!callback || key !== 'sign_type') && params[key] !== '',
  ).map((key) => `${key}=${params[key]}`).join('&');
}

export function canonicalPrice(plan: Plan, period: BillingPeriod): number {
  if (plan === Plan.FREE) throw new Error('免费版无需支付');
  const details = PLAN_DETAILS[plan];
  const amount = period === 'yearly' ? details.yearlyPrice : details.monthlyPrice;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('该套餐不支持所选付费周期');
  return amount;
}

export function createAlipayPagePayUrl(input: {
  orderNo: string; plan: Plan; billingPeriod: BillingPeriod; amount: number;
}): string {
  const appId = required('ALIPAY_APP_ID');
  const privateKey = required('ALIPAY_PRIVATE_KEY');
  const notifyUrl = required('ALIPAY_NOTIFY_URL');
  const returnUrl = required('ALIPAY_RETURN_URL');
  const expected = canonicalPrice(input.plan, input.billingPeriod);
  if (input.amount !== expected) throw new Error('订单金额与服务端会员价格不一致');
  const sandbox = process.env.ALIPAY_SANDBOX === 'true';
  if (process.env.NODE_ENV === 'production' && sandbox) throw new Error('生产环境禁止启用支付宝沙箱');
  if (process.env.NODE_ENV === 'production' &&
      (!notifyUrl.startsWith('https://') || !returnUrl.startsWith('https://'))) {
    throw new Error('生产环境支付宝回调地址必须使用 HTTPS');
  }
  const params: Record<string, string> = {
    app_id: appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    version: '1.0',
    notify_url: notifyUrl,
    return_url: returnUrl,
    biz_content: JSON.stringify({
      out_trade_no: input.orderNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: input.amount.toFixed(2),
      subject: `新能源智库-${input.plan}-${input.billingPeriod}`,
    }),
  };
  const signer = createSign('RSA-SHA256');
  signer.update(canonicalAlipayParams(params), 'utf8');
  params.sign = signer.sign(privateKey, 'base64');
  const gateway = process.env.ALIPAY_GATEWAY_URL || (sandbox ? SANDBOX_GATEWAY : PROD_GATEWAY);
  if (!gateway.startsWith('https://')) throw new Error('支付宝网关必须使用 HTTPS');
  return `${gateway}?${new URLSearchParams(params).toString()}`;
}

export function verifyAlipayCallback(params: Record<string, string>): boolean {
  if (params.app_id !== required('ALIPAY_APP_ID') ||
      params.seller_id !== required('ALIPAY_SELLER_ID') ||
      params.sign_type !== 'RSA2' || !params.sign) return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(canonicalAlipayParams(params, true), 'utf8');
  return verifier.verify(required('ALIPAY_PUBLIC_KEY'), params.sign, 'base64');
}
