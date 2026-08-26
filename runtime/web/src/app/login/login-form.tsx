'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, Shield, Zap } from 'lucide-react';
import { useLocale } from 'next-intl';

const text = {
  zh: {
    brand: '新能源智库', signIn: '登录', register: '注册', signInTitle: '登录您的账户', registerTitle: '创建账户',
    intro: '继续管理可复核的新能源项目分析。', registerIntro: '创建免费账户，先验证一个项目工作流。',
    name: '姓名或称呼', namePlaceholder: '如何称呼您', email: '邮箱', password: '密码', passwordLogin: '请输入密码', passwordNew: '至少 6 位',
    waiting: '请稍候…', submitLogin: '登录', submitRegister: '创建免费账户', consentPrefix: '我已阅读并同意', terms: '《服务条款》', and: '和', privacy: '《隐私政策》',
    consentError: '请先阅读并同意服务条款和隐私政策', registerFailed: '注册失败', operationFailed: '操作失败，请稍后重试',
    safeguards: ['假设与来源可追溯', '付费权益由服务端校验', '重要结论需人工复核'], disclaimer: '本产品提供辅助分析，不构成投资、工程、法律或安全保证。', support: '联系支持',
    authNotConfigured: '登录服务暂未开放：服务端尚未配置登录所需的环境变量（NEXTAUTH_URL / NEXTAUTH_SECRET）。您可以先浏览公开页面，或联系管理员完成配置后再登录。',
  },
  en: {
    brand: 'Energy Intelligence', signIn: 'Sign in', register: 'Create account', signInTitle: 'Sign in to your workspace', registerTitle: 'Create an account',
    intro: 'Continue a reviewable renewable-energy assessment.', registerIntro: 'Start with one project workflow before procurement.',
    name: 'Name', namePlaceholder: 'How should we address you?', email: 'Email', password: 'Password', passwordLogin: 'Enter your password', passwordNew: 'At least 6 characters',
    waiting: 'Please wait…', submitLogin: 'Sign in', submitRegister: 'Create free account', consentPrefix: 'I have read and agree to the', terms: 'Terms of Service', and: 'and', privacy: 'Privacy Policy',
    consentError: 'Read and accept the Terms of Service and Privacy Policy before creating an account.', registerFailed: 'Registration failed', operationFailed: 'The request failed. Please try again.',
    safeguards: ['Traceable assumptions and sources', 'Server-enforced paid entitlements', 'Human review for material conclusions'], disclaimer: 'Decision support only. This service does not provide an investment, engineering, legal, tax, grid, or safety guarantee.', support: 'Contact support',
    authNotConfigured: 'Sign-in is not available yet: the server is missing required auth configuration (NEXTAUTH_URL / NEXTAUTH_SECRET). You can keep browsing public pages or contact the administrator.',
  },
} as const;

export default function LoginForm({ authConfigured }: { authConfigured: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const copy = locale === 'en' ? text.en : text.zh;
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const supportEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!authConfigured) return; // 未配置时表单降级为展示，不发起无效请求
    if (!isLogin && !accepted) return setError(copy.consentError);
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const result = await signIn('credentials', { email, password, redirect: false });
        if (result?.error) setError(result.error);
        else router.push(callbackUrl);
      } else {
        const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name, locale }) });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setError(payload.error || copy.registerFailed);
        } else {
          const result = await signIn('credentials', { email, password, redirect: false });
          if (result?.ok) router.push('/onboarding');
          else setError(result?.error || copy.operationFailed);
        }
      }
    } catch {
      setError(copy.operationFailed);
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
    <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <Link href="/" className="flex items-center gap-3 text-xl font-black"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500"><Zap className="h-6 w-6" /></span>{copy.brand}</Link>
      <div><p className="text-sm font-bold uppercase tracking-[.2em] text-emerald-400">{isLogin ? copy.signIn : copy.register}</p><h1 className="mt-4 max-w-xl text-5xl font-black leading-tight">{isLogin ? copy.intro : copy.registerIntro}</h1><div className="mt-9 space-y-4">{copy.safeguards.map(item => <div key={item} className="flex items-center gap-3 text-slate-300"><Check className="h-5 w-5 text-emerald-400" />{item}</div>)}</div><p className="mt-9 max-w-xl text-sm leading-6 text-slate-400">{copy.disclaimer}</p></div>
      <p className="text-sm text-slate-500">© {new Date().getFullYear()} {copy.brand}</p>
    </section>

    <section className="flex items-center justify-center p-4 sm:p-8"><div className="w-full max-w-md"><Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-black lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white"><Zap className="h-5 w-5" /></span>{copy.brand}</Link><div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-8"><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => { setIsLogin(true); setError(''); }} className={`rounded-lg py-3 text-sm font-bold ${isLogin ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>{copy.signIn}</button><button type="button" onClick={() => { setIsLogin(false); setError(''); }} className={`rounded-lg py-3 text-sm font-bold ${!isLogin ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'}`}>{copy.register}</button></div><h2 className="mt-8 text-2xl font-black">{isLogin ? copy.signInTitle : copy.registerTitle}</h2><p className="mt-2 text-slate-500">{isLogin ? copy.intro : copy.registerIntro}</p>
        {!authConfigured && <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{copy.authNotConfigured}</div>}
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">{!isLogin && <label className="block text-sm font-semibold text-slate-700">{copy.name}<input value={name} onChange={e => setName(e.target.value)} required className="mt-1 w-full rounded-xl bg-slate-50 px-4 py-3 outline-none ring-emerald-500 focus:ring-2" placeholder={copy.namePlaceholder} /></label>}<label className="block text-sm font-semibold text-slate-700">{copy.email}<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="mt-1 w-full rounded-xl bg-slate-50 px-4 py-3 outline-none ring-emerald-500 focus:ring-2" placeholder="name@example.com" /></label><label className="block text-sm font-semibold text-slate-700">{copy.password}<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={isLogin ? 'current-password' : 'new-password'} className="mt-1 w-full rounded-xl bg-slate-50 px-4 py-3 outline-none ring-emerald-500 focus:ring-2" placeholder={isLogin ? copy.passwordLogin : copy.passwordNew} /></label>
          {!isLogin && <label className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={accepted} onChange={e => { setAccepted(e.target.checked); if (e.target.checked) setError(''); }} className="mt-1 h-4 w-4 accent-emerald-600" /><span>{copy.consentPrefix} <Link href="/terms" target="_blank" className="font-bold text-emerald-700">{copy.terms}</Link> {copy.and} <Link href="/privacy" target="_blank" className="font-bold text-emerald-700">{copy.privacy}</Link>.</span></label>}
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<button disabled={loading || !authConfigured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{loading ? copy.waiting : isLogin ? copy.submitLogin : copy.submitRegister}<ArrowRight className="h-4 w-4" /></button>
        </form>
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{copy.disclaimer}</div>
      </div>{supportEmail && <a href={`mailto:${supportEmail}`} className="mt-6 block text-center text-sm text-slate-500 hover:text-emerald-700">{copy.support}: {supportEmail}</a>}</div></section>
  </main>;
}
