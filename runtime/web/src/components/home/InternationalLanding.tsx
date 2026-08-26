'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, Check, Database, FileText, Globe2, Shield, Users, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';

const priorityIcons = [Shield, BarChart3, Users];

export default function InternationalLanding() {
  const t = useTranslations('InternationalLanding');
  const priorities = t.raw('why.priorities') as Array<{ title: string; body: string }>;
  const workflow = t.raw('workflow.steps') as Array<{ number: string; title: string; body: string }>;
  const cardItems = t.raw('card.items') as string[];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={t('brandAria')}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500"><Zap className="h-5 w-5" /></span>
            <span className="hidden whitespace-nowrap text-base font-bold min-[440px]:inline sm:text-xl">{t('brand')}</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex"><Link href="#why" className="text-sm text-slate-300 hover:text-white">{t('nav.why')}</Link><Link href="#workflow" className="text-sm text-slate-300 hover:text-white">{t('nav.workflow')}</Link><Link href="#plans" className="text-sm text-slate-300 hover:text-white">{t('nav.plans')}</Link></div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3"><LanguageSwitcher /><Link href="/login" className="hidden whitespace-nowrap text-sm font-medium text-slate-300 hover:text-white sm:inline">{t('nav.signIn')}</Link><Link href="/login" className="whitespace-nowrap rounded-xl bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">{t('nav.startFree')}</Link></div>
        </div>
      </nav>
      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:pt-36">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.18),transparent_38%),radial-gradient(circle_at_20%_60%,rgba(14,165,233,0.12),transparent_34%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300"><Globe2 className="h-4 w-4" /> {t('hero.badge')}</div><h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">{t('hero.title')}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{t('hero.subtitle')}</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-300">{t('hero.createAssessment')} <ArrowRight className="h-4 w-4" /></Link><Link href="/developer/docs" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-semibold hover:bg-white/10"><FileText className="h-4 w-4" /> {t('hero.exploreApi')}</Link></div><p className="mt-4 text-sm text-slate-400">{t('hero.disclaimer')}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm text-slate-400">{t('card.eyebrow')}</p><p className="mt-1 text-2xl font-bold">{t('card.title')}</p></div><Database className="h-9 w-9 text-emerald-300" /></div><div className="space-y-3">{cardItems.map((item) => <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-900/60 p-3 text-sm text-slate-200"><Check className="h-5 w-5 shrink-0 text-emerald-300" />{item}</div>)}</div></div>
          </div>
        </section>
        <section id="why" className="border-y border-white/10 bg-slate-900/60 px-4 py-20"><div className="mx-auto max-w-6xl"><p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">{t('why.eyebrow')}</p><h2 className="mt-3 max-w-3xl text-3xl font-black sm:text-4xl">{t('why.title')}</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{priorities.map(({ title, body }, index) => { const Icon = priorityIcons[index]; return <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-6"><Icon className="h-7 w-7 text-emerald-300" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-slate-400">{body}</p></article>; })}</div></div></section>
        <section id="workflow" className="px-4 py-20"><div className="mx-auto max-w-6xl"><h2 className="text-3xl font-black sm:text-4xl">{t('workflow.title')}</h2><div className="mt-10 grid gap-5 lg:grid-cols-3">{workflow.map(({ number, title, body }) => <article key={number} className="rounded-2xl border border-white/10 p-6"><span className="text-sm font-black text-emerald-300">STEP {number}</span><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-slate-400">{body}</p></article>)}</div></div></section>
        <section id="plans" className="bg-emerald-400 px-4 py-16 text-slate-950"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><h2 className="text-3xl font-black">{t('plans.title')}</h2><p className="mt-2 max-w-2xl text-emerald-950/80">{t('plans.body')}</p></div><Link href="/pricing" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">{t('plans.compare')} <ArrowRight className="h-4 w-4" /></Link></div></section>
      </main>
      <footer className="border-t border-white/10 px-4 py-10 text-sm text-slate-400"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 sm:flex-row"><div><p className="font-bold text-white">{t('brand')}</p><p className="mt-1">{t('footer.tagline')}</p></div><div className="flex flex-wrap gap-5"><Link href="/privacy" className="hover:text-white">{t('footer.privacy')}</Link><Link href="/terms" className="hover:text-white">{t('footer.terms')}</Link><Link href="/login" className="hover:text-white">{t('footer.support')}</Link></div></div></footer>
    </div>
  );
}
