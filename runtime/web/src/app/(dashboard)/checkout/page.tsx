'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Info, ShieldCheck } from 'lucide-react';
import { useLocale } from 'next-intl';
import { PLAN_DETAILS, Plan } from '@/lib/membership/plans';

const purchasable = [Plan.PRO, Plan.MAINTENANCE, Plan.FULL] as const;
type PurchasablePlan = (typeof purchasable)[number];

export default function CheckoutPage() {
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const searchParams = useSearchParams();
  const isEnglish = useLocale() === 'en';
  const requested = searchParams.get('plan')?.toUpperCase() as Plan | undefined;
  const plan: PurchasablePlan = requested && (purchasable as readonly Plan[]).includes(requested)
    ? requested as PurchasablePlan
    : Plan.PRO;
  const billing = searchParams.get('billing') === 'yearly' ? 'yearly' : 'monthly';
  const details = PLAN_DETAILS[plan];
  const amount = billing === 'yearly' ? details.yearlyPrice : details.monthlyPrice;
  const planName = isEnglish
    ? ({ PRO: 'Professional', MAINTENANCE: 'Operations', FULL: 'Complete' } as const)[plan]
    : details.name;

  async function startAlipay() {
    setPaying(true);
    setPaymentError('');
    try {
      const response = await fetch('/api/membership/upgrade', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, billingPeriod: billing }),
      });
      const result = await response.json();
      if (!response.ok || !result.paymentUrl) throw new Error(result.message || '支付订单创建失败');
      window.location.assign(result.paymentUrl);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : '支付订单创建失败，请稍后重试');
      setPaying(false);
    }
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <nav className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/pricing" className="flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" />{isEnglish ? 'Back to plans' : '返回方案'}</Link><span className="font-black">{isEnglish ? 'Order review' : '订单确认'}</span></div></nav>
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
        <p className="text-sm font-bold text-emerald-700">{isEnglish ? 'Selected plan' : '已选方案'}</p>
        <h1 className="mt-2 text-3xl font-black">{planName}</h1>
        <div className="mt-7 rounded-2xl bg-slate-50 p-5"><div className="flex justify-between gap-4"><span className="text-slate-600">{isEnglish ? (billing === 'yearly' ? 'Annual term' : 'Monthly term') : (billing === 'yearly' ? '按年' : '按月')}</span><strong>{isEnglish ? 'Commercial quote required' : `¥${amount}`}</strong></div></div>
        <div className="mt-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><Info className="mt-0.5 h-5 w-5 shrink-0" /><p>{isEnglish ? 'International price, currency, tax, data residency, support scope, renewal, and cancellation terms must be confirmed in a written quote. This page does not collect payment or activate access.' : '订单金额由服务端会员价格生成。支付宝确认到账并通过签名、商户、应用和金额校验后，系统才会开通权益；付款前请查看发票、续费与退款条款。'}</p></div>
        <div className="mt-7 space-y-3 text-sm text-slate-700">{[
          isEnglish ? 'No access is activated from client-side state.' : '前端状态不会直接开通权益。',
          isEnglish ? 'Activation requires verified payment or an approved contract.' : '仅在支付验证成功或合同审核通过后生效。',
          isEnglish ? 'Final entitlements are recorded by the server.' : '最终会员等级和额度由服务端记录。',
        ].map(item => <div key={item} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{item}</div>)}</div>
      </section>
      <aside className="h-fit rounded-3xl bg-slate-900 p-7 text-white"><ShieldCheck className="h-9 w-9 text-emerald-400" /><h2 className="mt-5 text-2xl font-black">{isEnglish ? 'Request a reviewable quote' : '支付宝安全支付'}</h2><p className="mt-3 text-sm leading-6 text-slate-300">{isEnglish ? 'Tell us your region, organization size, data residency needs, and required integrations. Do not submit confidential project files in the initial request.' : `本次应付 ¥${amount}，支付结果以支付宝服务端通知为准，不接受前端自报成功。`}</p>{isEnglish ? <Link href={`/demo-request?market=global&plan=${plan}&billing=${billing}`} className="mt-7 block rounded-xl bg-emerald-400 px-4 py-3 text-center font-bold text-slate-950 hover:bg-emerald-300">Request a quote</Link> : <button type="button" onClick={startAlipay} disabled={paying} className="mt-7 w-full rounded-xl bg-emerald-400 px-4 py-3 text-center font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60">{paying ? '正在创建安全订单…' : `支付宝支付 ¥${amount}`}</button>}{paymentError && <p role="alert" className="mt-3 text-sm text-rose-300">{paymentError}</p>}<Link href="/terms" className="mt-4 block text-center text-sm text-slate-400 hover:text-white">{isEnglish ? 'Review service terms' : '查看服务条款'}</Link></aside>
    </main>
  </div>;
}
