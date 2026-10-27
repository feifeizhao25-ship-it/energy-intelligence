'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Check, Info, ShieldCheck } from 'lucide-react';
import { PLAN_DETAILS, Plan } from '@/lib/membership/plans';
import { safeErrorMessage } from '@/lib/api/safe-error';

// 自助结算只开放专业版与专家版；团队版、企业版走销售（MAINTENANCE 已停售）
const purchasable = [Plan.PRO, Plan.FULL] as const;
type PurchasablePlan = (typeof purchasable)[number];

export default function CheckoutClient({ planParam, billingParam }: { planParam?: string; billingParam?: string }) {
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [wechatCode, setWechatCode] = useState('');
  const requested = planParam?.toUpperCase() as Plan | undefined;
  const plan: PurchasablePlan = requested && (purchasable as readonly Plan[]).includes(requested)
    ? requested as PurchasablePlan
    : Plan.PRO;
  // 年付为唯一在售计费周期 (entitlements sales_billing_period=yearly); 旧 billing=monthly 链接一律按年付结算, 不再产生月付订单
  const billing = 'yearly' as const;
  const details = PLAN_DETAILS[plan];
  const amount = details.yearlyPrice;
  const planName = details.name;

  async function startPay(method: 'alipay' | 'wechat') {
    setPaying(true);
    setPaymentError('');
    setWechatCode('');
    try {
      const response = await fetch('/api/membership/upgrade', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, billingPeriod: billing, method }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '支付订单创建失败');
      if (method === 'wechat') {
        const code = result.wechat?.code_url;
        if (!code) throw new Error(result.message || '微信支付订单创建失败');
        setWechatCode(code);
        setPaying(false);
        return;
      }
      if (!result.paymentUrl) throw new Error(result.message || '支付订单创建失败');
      window.location.assign(result.paymentUrl);
    } catch (error) {
      setPaymentError(safeErrorMessage(error, '支付订单创建失败，请稍后重试'));
      setPaying(false);
    }
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <nav className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/pricing" className="flex items-center gap-2 text-sm font-bold text-slate-600"><ArrowLeft className="h-4 w-4" />返回方案</Link><span className="font-black">订单确认</span></div></nav>
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9">
        <p className="text-sm font-bold text-emerald-700">已选方案</p>
        <h1 className="mt-2 text-3xl font-black">{planName}</h1>
        <div className="mt-7 rounded-2xl bg-slate-50 p-5"><div className="flex justify-between gap-4"><span className="text-slate-600">{(billing === 'yearly' ? '按年' : '按月')}</span><strong>{`¥${amount}`}</strong></div></div>
        <div className="mt-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><Info className="mt-0.5 h-5 w-5 shrink-0" /><p>订单金额由服务端会员价格生成。支付宝确认到账并通过签名、商户、应用和金额校验后，系统才会开通权益；付款前请查看发票、续费与退款条款。</p></div>
        <div className="mt-7 space-y-3 text-sm text-slate-700">{[
          '前端状态不会直接开通权益。',
          '仅在支付验证成功或合同审核通过后生效。',
          '最终会员等级和额度由服务端记录。',
        ].map(item => <div key={item} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{item}</div>)}</div>
      </section>
      <aside className="h-fit rounded-3xl bg-slate-900 p-7 text-white"><ShieldCheck className="h-9 w-9 text-emerald-400" /><h2 className="mt-5 text-2xl font-black">支付宝安全支付</h2><p className="mt-3 text-sm leading-6 text-slate-300">{`本次应付 ¥${amount}，支付结果以支付宝服务端通知为准，不接受前端自报成功。`}</p>{<button type="button" onClick={() => startPay('alipay')} disabled={paying} className="mt-7 w-full rounded-xl bg-emerald-400 px-4 py-3 text-center font-bold text-slate-950 hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60">{paying ? '正在创建安全订单…' : `支付宝支付 ¥${amount}`}</button>}{<button type="button" onClick={() => startPay('wechat')} disabled={paying} className="mt-3 w-full rounded-xl border border-emerald-400 px-4 py-3 text-center font-bold text-emerald-300 hover:bg-emerald-400/10 disabled:cursor-wait disabled:opacity-60">微信扫码支付</button>}{wechatCode && <div className="mt-3 space-y-2 text-xs leading-5 text-slate-300"><p>请用微信扫描通道返回的收款链接。到账以服务端通知为准。</p><p className="break-all">{wechatCode}</p></div>}{paymentError && <p role="alert" className="mt-3 text-sm text-rose-300">{paymentError}</p>}<Link href="/terms" className="mt-4 block text-center text-sm text-slate-400 hover:text-white">查看服务条款</Link></aside>
    </main>
  </div>;
}
