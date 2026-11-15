'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 政策审核（只给审核员看）：爬虫抓取、大模型抽取的政策条目一律先是「待审核」，
 * 只有在这里「通过」的条目才会进入收益测算、AI 回答和工作台。审核人与时间由服务端记录。
 * 谁是审核员由运营方在环境变量 POLICY_REVIEWERS 中指定；非审核员访问看到「页面不存在」。
 */

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
interface PolicyItem {
    id: string; region: string; type: string; value: number; unit: string; conditions: string | null;
    sourceUrl: string | null; sourceTitle: string | null; docNumber: string | null;
    publishedAt: string | null; fetchedAt: string | null; startDate: string | null; endDate: string | null;
    reviewStatus: Status; reviewer: string | null; reviewedAt: string | null;
}

const STATUS_LABEL: Record<Status, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' };
const TYPE_LABEL: Record<string, string> = { SUBSIDY_KWH: '度电补贴', SUBSIDY_ONE_TIME: '一次性补贴', ELECTRICITY_PRICE: '电价' };
const day = (v: string | null) => (v ? new Date(v).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—');
const time = (v: string | null) => (v ? new Date(v).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—');

export default function PolicyReviewPage() {
    const [status, setStatus] = useState<Status>('PENDING');
    const [items, setItems] = useState<PolicyItem[]>([]);
    const [counts, setCounts] = useState<Partial<Record<Status, number>>>({});
    const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    const load = useCallback(async (s: Status) => {
        setState('loading');
        try {
            const res = await fetch(`/api/admin/policies?status=${s}`, { cache: 'no-store' });
            if (res.status === 401) { setState('forbidden'); return; }
            const body = await res.json();
            if (!res.ok) throw new Error();
            if (body.roleFallback) {
                setItems([]);
                setMessage(body.note || '当前角色不能审核政策，这里不展示待审列表。');
                setState('forbidden');
                return;
            }
            setItems(body.items);
            setCounts(body.counts ?? {});
            setState('ready');
        } catch {
            setState('error');
        }
    }, []);

    useEffect(() => { load(status); }, [status, load]);

    async function review(id: string, decision: 'APPROVED' | 'REJECTED') {
        setBusyId(id);
        setMessage('');
        try {
            const res = await fetch(`/api/admin/policies/${id}/review`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : '操作失败');
            setMessage(`已${decision === 'APPROVED' ? '通过' : '驳回'}：${body.policy?.sourceTitle ?? body.policy?.region ?? ''}（审核人 ${body.policy?.reviewer}）`);
            await load(status);
        } catch (e) {
            setMessage(e instanceof Error && /[一-鿿]/.test(e.message) ? e.message : '操作失败，请稍后重试');
        } finally {
            setBusyId(null);
        }
    }

    if (state === 'forbidden') {
        return <div className="mx-auto max-w-xl p-10 text-center text-slate-500">页面不存在或你没有访问权限。</div>;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 p-4 pb-16 text-slate-800">
            <header>
                <h1 className="text-2xl font-black">政策审核</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                    抓取与大模型抽取的政策条目默认「待审核」，只有审核通过的才会进入收益测算、AI 回答和用户工作台。
                    请对照原文核对地区、类型、数值、单位与有效期后再通过；审核人和时间自动记录。
                </p>
            </header>

            <div className="flex flex-wrap gap-2" role="tablist">
                {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
                    <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
                        className={cn('rounded-full px-4 py-1.5 text-sm font-bold border', status === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200')}>
                        {STATUS_LABEL[s]}{typeof counts[s] === 'number' ? `（${counts[s]}）` : ''}
                    </button>
                ))}
            </div>

            {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
            {state === 'loading' && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
            {state === 'error' && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">列表加载失败，请稍后重试。</p>}
            {state === 'ready' && items.length === 0 && <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 border border-slate-100">没有「{STATUS_LABEL[status]}」的政策条目。</p>}

            {state === 'ready' && items.map(item => (
                <article key={item.id} data-testid="policy-review-item" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h2 className="font-bold">{item.sourceTitle || `${item.region}${TYPE_LABEL[item.type] ?? item.type}`}</h2>
                            <p className="text-xs text-slate-500">{item.docNumber || '未识别文号'} · 发布 {day(item.publishedAt)} · 抓取 {time(item.fetchedAt)}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{STATUS_LABEL[item.reviewStatus]}</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                        <div><dt className="text-xs text-slate-400">地区</dt><dd>{item.region}</dd></div>
                        <div><dt className="text-xs text-slate-400">类型</dt><dd>{TYPE_LABEL[item.type] ?? item.type}</dd></div>
                        <div><dt className="text-xs text-slate-400">数值</dt><dd className="font-bold">{item.value} {item.unit}</dd></div>
                        <div><dt className="text-xs text-slate-400">有效期</dt><dd>{day(item.startDate)} 至 {item.endDate ? day(item.endDate) : '未注明'}</dd></div>
                    </dl>
                    {item.conditions && <p className="text-xs leading-5 text-slate-500">适用条件：{item.conditions}</p>}
                    {item.sourceUrl
                        ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 underline">打开原文<ExternalLink className="h-3 w-3" /></a>
                        : <p className="text-xs text-amber-700">没有原文链接，无法核对时请驳回。</p>}
                    {item.reviewer && <p className="text-xs text-slate-500">审核人：{item.reviewer} · {time(item.reviewedAt)}</p>}
                    <div className="flex gap-2">
                        {item.reviewStatus !== 'APPROVED' && (
                            <button disabled={busyId === item.id} onClick={() => review(item.id, 'APPROVED')}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                <CheckCircle2 className="h-4 w-4" />通过
                            </button>
                        )}
                        {item.reviewStatus !== 'REJECTED' && (
                            <button disabled={busyId === item.id} onClick={() => review(item.id, 'REJECTED')}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">
                                <XCircle className="h-4 w-4" />驳回
                            </button>
                        )}
                    </div>
                </article>
            ))}
        </div>
    );
}
