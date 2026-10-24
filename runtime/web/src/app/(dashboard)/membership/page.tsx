'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Award, Calendar, Database, Loader2, TrendingUp, Zap } from 'lucide-react';
import { Plan, PLAN_DETAILS, USAGE_LIMITS } from '@/lib/membership/plans';

import { loadMember, type Member, type Payment } from '@/lib/membership/load-member';

export default function MembershipCenterPage() {
    const [member, setMember] = useState<Member | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [paymentsError, setPaymentsError] = useState('');

    async function loadMorePayments() {
        const nextCursor = member?.paymentPagination?.nextCursor;
        if (!nextCursor || paymentsLoading) return;
        setPaymentsLoading(true); setPaymentsError('');
        try {
            const data = await loadMember(`/api/membership/me?paymentCursor=${encodeURIComponent(nextCursor)}`);
            if (data.id !== member?.id) throw new Error('账户已变化，请刷新页面');
            setMember(current => current?.subscription ? { ...current,
                paymentPagination: data.paymentPagination,
                subscription: { ...current.subscription, payments: [...new Map(
                    [...current.subscription.payments, ...(data.subscription?.payments || [])]
                        .map((payment: Payment) => [payment.id, payment])).values()] }
            } : current);
        } catch (reason) {
            setPaymentsError(reason instanceof Error ? reason.message : '付款记录加载失败，请重试');
        } finally { setPaymentsLoading(false); }
    }

    useEffect(() => {
        const controller = new AbortController();
        setError('');
        loadMember('/api/membership/me', controller.signal)
            .then(data => { if (!controller.signal.aborted) setMember(data); })
            .catch(reason => {
                if (!controller.signal.aborted) setError(reason.message || '会员信息加载失败');
            });
        return () => controller.abort();
    }, [attempt]);

    if (error) return <State message={error} error onRetry={() => { setError(''); setAttempt(value => value + 1); }} />;
    if (!member) return <State message="正在读取您的会员权益…" />;

    const details = PLAN_DETAILS[member.plan] || PLAN_DETAILS.FREE;
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
                        <Benefit icon={<Database />} text={`${effectiveLimits.projects === Infinity ? '不限量' : `最多 ${effectiveLimits.projects} 个`} 项目`} />
                        <Benefit icon={<Award />} text={effectivePlan === Plan.FREE ? '基础计算与查询' : '专业报告导出'} />
                        <Benefit icon={<Calendar />} text={member.subscription?.autoRenew ? '已开启自动续费' : '未开启自动续费'} />
                    </div>
                </section>

                <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
                    <h3 className="text-xl font-bold">付款记录</h3>
                    {payments.length === 0 ? <p className="mt-4 text-slate-400">暂无已完成的付款记录。</p> : (
                        <div className="mt-4 divide-y divide-slate-800">
                            {payments.map(payment => <div key={payment.id} className="py-4 flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-4"><div className="min-w-0 [overflow-wrap:anywhere]"><p>{payment.description || '会员订阅'}</p><p className="text-sm text-slate-400">{new Date(payment.paidAt || payment.createdAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）</p></div><strong className="shrink-0 whitespace-nowrap">{payment.currency === 'CNY' ? '¥' : `${payment.currency} `}{Number(payment.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>)}
                        </div>
                    )}
                    {paymentsError && <p role="alert" className="mt-4 text-red-300">{paymentsError}</p>}
                    {member.paymentPagination?.nextCursor && <button type="button" onClick={loadMorePayments} disabled={paymentsLoading} className="mt-4 rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">{paymentsLoading ? '正在加载付款记录…' : '加载更多付款记录'}</button>}
                </section>

                <BillingActions member={member} onChanged={() => setAttempt(value => value + 1)} />
            </div>
        </main>
    );
}

function State({ message, error = false, onRetry }: { message: string; error?: boolean; onRetry?: () => void }) {
    return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><div className="space-y-5">
        <div role={error ? 'alert' : 'status'} className="flex items-center gap-3">{error ? <AlertCircle className="text-red-400 shrink-0" /> : <Loader2 className="animate-spin text-blue-400" />}<span>{message}</span></div>
        {onRetry && <div className="flex flex-wrap items-center gap-5"><button type="button" onClick={onRetry} className="rounded-lg bg-indigo-600 px-5 py-3">重新加载会员信息</button><Link href="/login?callbackUrl=%2Fmembership" className="text-indigo-300 underline">重新登录</Link></div>}
    </div></main>;
}
function BillingActions({ member, onChanged }: { member: Member; onChanged: () => void }) {
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState('');
    const [selectedPaymentId, setSelectedPaymentId] = useState('');
    const expiry = member.planExpireAt ? new Date(member.planExpireAt) : null;
    const active = member.plan !== Plan.FREE && expiry !== null && expiry.getTime() > Date.now() && member.plan === member.effectivePlan;
    const targets = (Object.keys(PLAN_DETAILS) as Plan[]).filter(plan => {
        const rank = [Plan.FREE, Plan.PRO, Plan.MAINTENANCE, Plan.FULL, Plan.TEAM, Plan.ENTERPRISE];
        return plan !== Plan.MAINTENANCE && rank.indexOf(plan) >= 0 && rank.indexOf(plan) < rank.indexOf(member.plan);
    });
    async function run(key: string, url: string, body: unknown) {
        setPending(key); setMessage('');
        try {
            const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || '操作没有完成，请稍后再试');
            if (data.refundCny) setMessage(`测算应退 ¥${data.refundCny}（实付 ¥${data.paidCny}，剩余 ${data.remainingDays} 天）。这只是测算，不会自动退款。`);
            else setMessage(data.message || '已登记');
            if (url === '/api/membership/downgrade') onChanged();
        } catch (reason) {
            setMessage(reason instanceof Error ? reason.message : '操作没有完成，请稍后再试');
        } finally { setPending(''); }
    }
    const payments = (member.subscription?.payments || []).filter(payment => payment.orderNo);
    const selectedPayment = payments.find(payment => payment.id === selectedPaymentId) || payments[0];
    return <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <h3 className="text-xl font-bold">续费、降级与退款测算</h3>
        <p className="text-sm text-slate-400">续费请到价格页购买同一方案，未到期从现到期日顺延一年。降级到期后才生效，不退差价。退款只根据已支付订单测算，财务在支付宝后台人工办理。</p>
        {member.subscription?.scheduledPlan && <p className="text-amber-100">已登记到期后改为 {PLAN_DETAILS[member.subscription.scheduledPlan as Plan]?.name || member.subscription.scheduledPlan}。</p>}
        {active && <div className="flex flex-wrap gap-3">{targets.map(plan => <button key={plan} type="button" disabled={pending !== ''} onClick={() => run(plan, '/api/membership/downgrade', { plan })} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">{pending === plan ? '正在登记…' : `到期后改为${PLAN_DETAILS[plan].name}`}</button>)}</div>}
        {selectedPayment && <div className="space-y-3 min-w-0">
            <label htmlFor="refund-order" className="block text-sm font-medium">选择退款测算订单</label>
            <select id="refund-order" value={selectedPayment.id} disabled={pending !== ''}
                onChange={event => { setSelectedPaymentId(event.target.value); setMessage(''); }}
                className="w-full min-w-0 rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-white">
                {payments.map(payment => <option key={payment.id} value={payment.id}>{payment.orderNo}</option>)}
            </select>
            <p className="text-sm text-slate-300 break-all">当前订单：{selectedPayment.orderNo}</p>
            <p className="text-sm text-slate-400">可选择已加载的付款记录；更早订单请先在上方加载更多。没有完整服务周期的订单需要财务人工核对。</p>
            <button type="button" disabled={pending !== ''}
                onClick={() => run(selectedPayment.id, '/api/membership/refund/quote', { orderNo: selectedPayment.orderNo })}
                className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">
                {pending === selectedPayment.id ? '正在测算…' : '测算所选订单退款'}
            </button>
        </div>}
        {message && <p role="status" className="text-slate-200">{message}</p>}
    </section>;
}
function formatLimit(limit: number) { return limit === Infinity ? '不限量' : `最多 ${limit} 次`; }
function Usage({ label, value, limit }: { label: string; value: number; limit: number }) {
    const unlimited = limit === Infinity; const ratio = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : value / limit * 100);
    return <div><div className="flex justify-between text-sm"><span>{label}</span><span className="text-slate-400">{value} / {unlimited ? '不限量' : limit}</span></div><div className="mt-2 h-2 rounded bg-slate-800"><div className={`h-2 rounded ${ratio >= 100 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: unlimited ? '8%' : `${ratio}%` }} /></div></div>;
}
function Count({ label, value, limit }: { label: string; value: number; limit: number }) { return <div className="rounded-xl bg-slate-800 p-4"><p className="text-slate-400 text-sm">{label}</p><p className="text-2xl font-bold mt-1">{value}<span className="text-sm font-normal text-slate-500"> / {limit === Infinity ? '不限' : limit}</span></p></div>; }
function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="rounded-xl bg-slate-800 p-4 flex items-center gap-3"><span className="text-indigo-400">{icon}</span><span>{text}</span></div>; }
