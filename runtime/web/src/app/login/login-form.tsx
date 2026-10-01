'use client';

import React, { useEffect, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Shield, Zap } from 'lucide-react';
import { digitsOnly, isValidPhone, loginErrorMessage, RESEND_SECONDS, sendCodeErrorMessage } from '@/lib/auth/login-flow';
import { CONSENT_REQUIRED_MESSAGE } from '@/lib/legal/consent';

const copy = {
  brand: '新能源智库',
  title: '手机号登录 / 注册',
  intro: '继续管理可复核的新能源项目分析。首次登录会自动创建免费账户。',
  phone: '手机号', phonePlaceholder: '请输入 11 位手机号',
  code: '验证码', codePlaceholder: '6 位数字验证码',
  sendCode: '获取验证码', resend: (s: number) => `${s} 秒后重发`, sending: '发送中…',
  sent: '验证码已发送，请注意查收短信（10 分钟内有效）',
  invalidPhone: '请输入正确的 11 位手机号',
  invalidCode: '请输入 6 位数字验证码',
  waiting: '请稍候…', submit: '登录 / 注册',
  consentPrefix: '我已阅读并同意', terms: '《服务条款》', and: '和', privacy: '《隐私政策》',
  operationFailed: '操作失败，请稍后重试',
  safeguards: ['假设与来源可追溯', '付费权益由服务端校验', '重要结论需人工复核'],
  disclaimer: '本产品提供辅助分析，不构成投资、工程、法律或安全保证。',
  support: '联系支持',
  authNotConfigured: '登录服务暂未开放：服务端尚未配置登录所需的环境变量（NEXTAUTH_URL / NEXTAUTH_SECRET）。您可以先浏览公开页面，或联系管理员完成配置后再登录。',
};

export default function LoginForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const supportEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (!authConfigured || sending || cooldown > 0) return;
    setError(''); setNotice('');
    if (!isValidPhone(phone)) return setError(copy.invalidPhone);
    setSending(true);
    try {
      const response = await fetch('/api/auth/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(sendCodeErrorMessage(payload, response.status));
        // 服务端说「60 秒内已发过」时，按钮也进入冷却，避免用户连点
        if (response.status === 429) setCooldown(RESEND_SECONDS);
      } else {
        setNotice(copy.sent);
        setCooldown(RESEND_SECONDS);
      }
    } catch {
      setError(copy.operationFailed);
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!authConfigured) return; // 未配置时表单降级为展示，不发起无效请求
    setError(''); setNotice('');
    if (!isValidPhone(phone)) return setError(copy.invalidPhone);
    if (!/^\d{6}$/.test(code)) return setError(copy.invalidCode);
    if (!accepted) return setError(CONSENT_REQUIRED_MESSAGE);
    setLoading(true);
    try {
      // 与服务端 authOptions 里的 provider id「sms」一致；consent 由服务端校验并记录同意凭证
      const result = await signIn('sms', { phone, code, consent: 'true', redirect: false });
      if (!result || result.error) {
        setError(loginErrorMessage(result?.error));
        return;
      }
      const session = await getSession();
      router.push(session?.user?.profileCompleted === false ? '/onboarding' : callbackUrl);
    } catch {
      setError(copy.operationFailed);
    } finally {
      setLoading(false);
    }
  }

  const field = 'mt-1 w-full rounded-xl bg-slate-50 px-4 py-3 outline-none ring-emerald-500 focus:ring-2';

  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
    <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <Link href="/" className="flex items-center gap-3 text-xl font-black"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500"><Zap className="h-6 w-6" /></span>{copy.brand}</Link>
      <div><p className="text-sm font-bold tracking-[.2em] text-emerald-400">登录</p><h1 className="mt-4 max-w-xl text-5xl font-black leading-tight">{copy.intro}</h1><div className="mt-9 space-y-4">{copy.safeguards.map(item => <div key={item} className="flex items-center gap-3 text-slate-300"><Check className="h-5 w-5 text-emerald-400" />{item}</div>)}</div><p className="mt-9 max-w-xl text-sm leading-6 text-slate-400">{copy.disclaimer}</p></div>
      <p className="text-sm text-slate-500">© {new Date().getFullYear()} {copy.brand}</p>
    </section>

    <section className="flex items-center justify-center p-4 sm:p-8"><div className="w-full max-w-md"><Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><Zap className="h-5 w-5" /></span>{copy.brand}</Link><div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-8">
        <h2 className="text-2xl font-black">{copy.title}</h2><p className="mt-2 text-slate-500">{copy.intro}</p>
        {!authConfigured && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{copy.authNotConfigured}</div>}
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">{copy.phone}<input type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={e => setPhone(digitsOnly(e.target.value, 11))} required className={field} placeholder={copy.phonePlaceholder} /></label>
          <div className="block text-sm font-semibold text-slate-700"><label htmlFor="sms-code">{copy.code}</label>
            <div className="mt-1 flex gap-2"><input id="sms-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(digitsOnly(e.target.value, 6))} required className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none ring-emerald-500 focus:ring-2" placeholder={copy.codePlaceholder} />
              <button type="button" onClick={sendCode} disabled={!authConfigured || sending || cooldown > 0} className="shrink-0 rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50">{sending ? copy.sending : cooldown > 0 ? copy.resend(cooldown) : copy.sendCode}</button></div></div>
          <label className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={accepted} onChange={e => { setAccepted(e.target.checked); if (e.target.checked) setError(''); }} className="mt-1 h-4 w-4 accent-emerald-600" /><span>{copy.consentPrefix} <Link href="/terms" target="_blank" className="font-bold text-emerald-700">{copy.terms}</Link> {copy.and} <Link href="/privacy" target="_blank" className="font-bold text-emerald-700">{copy.privacy}</Link>。</span></label>
          {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <button disabled={loading || !authConfigured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{loading ? copy.waiting : copy.submit}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{copy.disclaimer}</div>
      </div>{supportEmail && <a href={`mailto:${supportEmail}`} className="mt-6 block text-center text-sm text-slate-500 hover:text-emerald-700">{copy.support}: {supportEmail}</a>}</div></section>
  </main>;
}
