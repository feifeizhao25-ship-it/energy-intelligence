'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Crown, ShieldCheck } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Plan } from '@/lib/membership/plans';
import bundledRegistry from '@/lib/entitlements/entitlements.json';

/**
 * 套餐与权益文案的唯一事实源是后端权益注册表
 * （runtime/backend/data/entitlements.json，GET /api/entitlements）。
 * 本页构建期注入同步副本（scripts/sync-entitlements.mjs 保证一致），
 * 运行时再尝试从 API 拉取最新版本覆盖；API 不可用时回退到构建期副本。
 */

interface TierInfo {
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: { monthly_cny: number; yearly_cny: number };
  features_zh: string[];
  features_en: string[];
}

interface EntitlementsRegistry {
  product: string;
  version: string;
  tier_order: string[];
  tiers: Record<string, TierInfo>;
}

const registry = bundledRegistry as unknown as EntitlementsRegistry;

const planOrder = [Plan.FREE, Plan.PRO, Plan.MAINTENANCE, Plan.FULL, Plan.TEAM, Plan.ENTERPRISE] as const;

function tierKey(plan: Plan): string {
  return plan.toLowerCase();
}

function domesticPrice(tier: TierInfo) {
  if (tier.price.monthly_cny > 0) return `¥${tier.price.monthly_cny}/月`;
  if (tier.price.yearly_cny > 0) return `¥${tier.price.yearly_cny}/年`;
  return '¥0';
}

function isValidRegistry(data: unknown): data is EntitlementsRegistry {
  const r = data as EntitlementsRegistry;
  return Boolean(r && r.version && r.tiers && ['free', 'pro', 'team', 'enterprise'].every(t => r.tiers[t]));
}

export default function PricingPage() {
  const isEnglish = useLocale() === 'en';
  const [reg, setReg] = useState<EntitlementsRegistry>(registry);

  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_URL || '/api/backend').replace(/\/$/, '');
    fetch(`${base}/entitlements`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (isValidRegistry(data)) setReg(data); })
      .catch(() => { /* API 不可用时使用构建期注入副本 */ });
  }, []);

  return <div className="min-h-screen bg-slate-50 pb-20 text-slate-900">
    <header className="border-b border-slate-200 bg-white px-4 pb-16 pt-24 text-center">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700"><Crown className="h-4 w-4" />{isEnglish ? 'Plans and governance' : '会员方案与权益'}</div>
        <h1 className="mt-6 text-4xl font-black sm:text-6xl">{isEnglish ? 'Choose the controls your team needs.' : '选择与项目阶段匹配的能力'}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{isEnglish ? 'International commercial terms are confirmed by region, data residency, support scope, and tax requirements. We do not display an invented currency conversion.' : '价格、额度和导出权益直接来自统一会员配置；最终金额、续费与退款以下单确认页为准。'}</p>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {planOrder.map((plan) => {
          const tier = reg.tiers[tierKey(plan)];
          if (!tier) return null;
          const recommended = plan === Plan.PRO || plan === Plan.FULL;
          const href = plan === Plan.FREE
            ? '/login?callbackUrl=/dashboard'
            : isEnglish || plan === Plan.TEAM || plan === Plan.ENTERPRISE
              ? `/demo-request?market=${isEnglish ? 'global' : 'cn'}&plan=${plan}`
              : `/checkout?plan=${plan}&billing=monthly`;
          const features = isEnglish ? tier.features_en : tier.features_zh;
          return <article key={plan} className={`relative flex flex-col rounded-3xl border bg-white p-7 ${recommended ? 'border-emerald-500 shadow-xl shadow-emerald-100' : 'border-slate-200'}`}>
            {recommended && <span className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">{isEnglish ? 'Common choice' : '常用方案'}</span>}
            <h2 className="text-2xl font-black">{isEnglish ? tier.name_en : tier.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{isEnglish ? tier.description_en : tier.description}</p>
            <p className="mt-5 text-3xl font-black">{isEnglish ? (plan === Plan.FREE ? 'No charge' : 'Contact sales') : domesticPrice(tier)}</p>
            {!isEnglish && tier.price.yearly_cny > 0 && tier.price.monthly_cny > 0 && <p className="mt-1 text-sm text-slate-500">年付 ¥{tier.price.yearly_cny}</p>}
            <ul className="mt-6 flex-1 space-y-3">{features.map(feature => <li key={feature} className="flex gap-2 text-sm leading-6 text-slate-700"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{feature}</li>)}</ul>
            <Link href={href} className={`mt-7 rounded-xl px-4 py-3 text-center text-sm font-bold ${recommended ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{plan === Plan.FREE ? (isEnglish ? 'Start evaluation' : '免费开始') : (isEnglish || plan === Plan.TEAM || plan === Plan.ENTERPRISE ? (isEnglish ? 'Discuss requirements' : '联系销售') : '选择方案')}</Link>
          </article>;
        })}
      </div>

      <section className="mt-14 rounded-3xl bg-slate-900 p-8 text-white sm:p-10"><div className="flex flex-col gap-6 md:flex-row md:items-center"><ShieldCheck className="h-10 w-10 shrink-0 text-emerald-400" /><div><h2 className="text-2xl font-black">{isEnglish ? 'Entitlements are enforced by the server.' : '会员权益以后端校验为准'}</h2><p className="mt-2 leading-7 text-slate-300">{isEnglish ? 'The interface does not unlock paid access by changing local state. Activation requires verified payment or an approved enterprise contract. Usage, retention, export, and cancellation terms remain visible before commitment.' : '前端修改状态不会开通付费能力。会员仅在支付渠道验证成功或企业合同审核完成后生效，额度、保留期限、导出和取消规则需在确认前展示。'}</p></div></div></section>
    </main>
  </div>;
}
