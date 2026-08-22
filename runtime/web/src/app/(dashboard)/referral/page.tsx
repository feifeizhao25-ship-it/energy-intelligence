'use client';

import Link from 'next/link';
import { Gift, ShieldCheck } from 'lucide-react';

export default function ReferralPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-8 py-10 text-white">
          <Gift className="mb-4 h-10 w-10" />
          <h1 className="text-3xl font-black">邀请好友</h1>
          <p className="mt-2 text-emerald-50">只展示已由服务端签发的邀请码和真实奖励记录。</p>
        </div>
        <div className="space-y-5 p-8">
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-5 text-amber-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-bold">邀请服务尚未启用</h2>
              <p className="mt-1 text-sm leading-6">当前账户没有服务端签发的邀请码。系统不会生成示例邀请码、虚构好友记录或未配置的返现承诺。</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-500">邀请功能上线前，需要完成奖励规则审核、防刷机制、实名与税务处理、退款追回以及服务端账本。</p>
          <Link href="/dashboard" className="inline-flex rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-700">返回工作台</Link>
        </div>
      </section>
    </main>
  );
}
