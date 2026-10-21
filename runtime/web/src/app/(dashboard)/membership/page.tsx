'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Award, Calendar, Database, Loader2, TrendingUp, Zap } from 'lucide-react';
import { Plan, PLAN_DETAILS, USAGE_LIMITS } from '@/lib/membership/plans';

type Payment = { id: string; amount: number; currency: string; description?: string | null; paidAt?: string | null; createdAt: string };
type Member = {
    id: string; name?: string | null; email: string; plan: Plan; effectivePlan: Plan; nextResetAt: string; planExpireAt?: string | null;
    dailyAiCalls: number; dailyResourceQueries: number; dailyCalculations: number;
    dailyPaperSearches: number; dailyDiagnoses: number; projectCount: number;
    paperCount: number; stationCount: number; folderCount: number;
    paymentPagination?: { page: number; nextPage: number | null };
    subscription?: { status: string; endDate: string; autoRenew: boolean; payments: Payment[] } | null;
};

export default function MembershipCenterPage() {
    const [member, setMember] = useState<Member | null>(null);
    const [error, setError] = useState('');
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentsError, setPaymentsError] = useState('');

    async function loadMorePayments() {
        const nextPage = member?.paymentPagination?.nextPage;
        if (!nextPage || paymentsLoading) return;
        setPaymentsLoading(true); setPaymentsError('');
        try {
            const response = await fetch(`/api/membership/me?paymentPage=${nextPage}`, { cache: 'no-store' });
            const body = await response.json();
            if (!response.ok || body.success !== true) throw new Error(body.message || '付款记录加载失败');
            if (body.data.id !== member?.id) throw new Error('账户已变化，请刷新页面');
            setMember(current => current?.subscription ? { ...current,
                paymentPagination: body.data.paymentPagination,
                subscription: { ...current.subscription, payments: [...new Map(
                    [...current.subscription.payments, ...(body.data.subscription?.payments || [])]
                        .map((payment: Payment) => [payment.id, payment])).values()] }
            } : current);
        } catch (reason) {
            setPaymentsError(reason instanceof Error ? reason.message : '付款记录加载失败，请重试');
        } finally { setPaymentsLoading(false); }
    }

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/membership/me', { cache: 'no-store', signal: controller.signal })
            .then(async response => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.message || '会员信息加载失败');
                setMember(body.data);
            })
            .catch(reason => {
                if (reason.name !== 'AbortError') setError(reason.message || '会员信息加载失败');
            });
        return () => controller.abort();
    }, []);

    if (error) return <State message={error} error />;
    if (!member) return <State message="正在读取您的会员权益…" />;

    const details = PLAN_DETAILS[member.plan] || PLAN_DETAILS.FREE;
    const limits = USAGE_LIMITS[member.plan] || USAGE_LIMITS.FREE;
    const expiry = member.planExpireAt;
    const effectivePlan = member.effectivePlan;
    const active = member.plan === effectivePlan;
    const effectiveDetails = PLAN_DETAILS[effectivePlan];
    const effectiveLimits = USAGE_LIMITS[effectivePlan];
    const payments = member.subscription?.payments || [];

    return (
        <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header>
                    <h1 className="text-3xl md:text-4xl font-bold">会员中心</h1>
                    <p className="text-slate-400 mt-2">查看真实权益、当日用量、存储数量和付款记录</p>
                </header>

                {!active && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">原 {details.name} 已到期，当前按免费版权益执行。</div>}

                <section className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <span className="text-5xl" aria-hidden>{effectiveDetails.icon}</span>
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold">{effectiveDetails.name}</h2>
                                <p className="text-indigo-100 mt-1">{expiry ? `有效期至 ${new Date(expiry).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}` : '无固定到期日'}</p>
                            </div>
                        </div>
                        <Link href="/pricing" className="rounded-xl bg-white px-5 py-3 text-center font-semibold text-indigo-700 hover:bg-indigo-50">查看升级方案</Link>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
                        <h3 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="text-blue-400" />今日使用情况</h3>
                        <p className="text-sm text-slate-400 mt-2">按北京时间每日零点重置；下次重置：{new Date(member.nextResetAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）。</p>
                        <div className="mt-5 space-y-4">
                            <Usage label="AI 对话" value={member.dailyAiCalls} limit={effectiveLimits.ai_chat} />
                            <Usage label="资源查询" value={member.dailyResourceQueries} limit={effectiveLimits.resource_query} />
                            <Usage label="收益计算" value={member.dailyCalculations} limit={effectiveLimits.calculation} />
                            <Usage label="文献检索" value={member.dailyPaperSearches} limit={effectiveLimits.paper_search} />
                            <Usage label="运维诊断" value={member.dailyDiagnoses} limit={effectiveLimits.diagnosis} />
                        </div>
                    </section>
                    <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
                        <h3 className="text-xl font-bold flex items-center gap-2"><Database className="text-violet-400" />已保存内容</h3>
                        <div className="mt-5 grid grid-cols-2 gap-4">
                            <Count label="项目" value={member.projectCount} limit={effectiveLimits.projects} />
                            <Count label="文献" value={member.paperCount} limit={effectiveLimits.saved_papers} />
                            <Count label="电站" value={member.stationCount} limit={effectiveLimits.stations} />
                            <Count label="文献夹" value={member.folderCount} limit={effectiveLimits.folders} />
                        </div>
                    </section>
                </div>

                <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
                    <h3 className="text-xl font-bold flex items-center gap-2"><Award className="text-amber-400" />当前核心权益</h3>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-200">
                        <Benefit icon={<Zap />} text={`${formatLimit(effectiveLimits.ai_chat)} AI 对话`} />
                        <Benefit icon={<Database />} text={`${formatLimit(effectiveLimits.projects)} 项目`} />
                        <Benefit icon={<Award />} text={effectivePlan === Plan.FREE ? '基础计算与查询' : '专业报告导出'} />
                        <Benefit icon={<Calendar />} text={member.subscription?.autoRenew ? '已开启自动续费' : '未开启自动续费'} />
                    </div>
                </section>

                <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
                    <h3 className="text-xl font-bold">付款记录</h3>
                    {payments.length === 0 ? <p className="mt-4 text-slate-400">暂无已完成的付款记录。</p> : (
                        <div className="mt-4 divide-y divide-slate-800">
                            {payments.map(payment => <div key={payment.id} className="py-4 flex justify-between gap-4"><div><p>{payment.description || '会员订阅'}</p><p className="text-sm text-slate-400">{new Date(payment.paidAt || payment.createdAt).toLocaleDateString('zh-CN')}</p></div><strong>{payment.currency === 'CNY' ? '¥' : `${payment.currency} `}{payment.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>)}
                        </div>
                    )}
                    {paymentsError && <p role="alert" className="mt-4 text-red-300">{paymentsError}</p>}
                    {member.paymentPagination?.nextPage && <button type="button" onClick={loadMorePayments} disabled={paymentsLoading} className="mt-4 rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">{paymentsLoading ? '正在加载付款记录…' : '加载更多付款记录'}</button>}
                </section>
            </div>
        </main>
    );
}

function State({ message, error = false }: { message: string; error?: boolean }) {
    return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><div className="flex items-center gap-3">{error ? <AlertCircle className="text-red-400" /> : <Loader2 className="animate-spin text-blue-400" />}<span>{message}</span></div></main>;
}
function formatLimit(limit: number) { return limit === Infinity ? '不限量' : `最多 ${limit} 次`; }
function Usage({ label, value, limit }: { label: string; value: number; limit: number }) {
    const unlimited = limit === Infinity; const ratio = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : value / limit * 100);
    return <div><div className="flex justify-between text-sm"><span>{label}</span><span className="text-slate-400">{value} / {unlimited ? '不限量' : limit}</span></div><div className="mt-2 h-2 rounded bg-slate-800"><div className={`h-2 rounded ${ratio >= 100 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: unlimited ? '8%' : `${ratio}%` }} /></div></div>;
}
function Count({ label, value, limit }: { label: string; value: number; limit: number }) { return <div className="rounded-xl bg-slate-800 p-4"><p className="text-slate-400 text-sm">{label}</p><p className="text-2xl font-bold mt-1">{value}<span className="text-sm font-normal text-slate-500"> / {limit === Infinity ? '不限' : limit}</span></p></div>; }
function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="rounded-xl bg-slate-800 p-4 flex items-center gap-3"><span className="text-indigo-400">{icon}</span><span>{text}</span></div>; }
