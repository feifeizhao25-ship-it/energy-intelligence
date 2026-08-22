'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

type SubmitState =
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'success' }
    | { kind: 'error'; message: string };

export default function DemoRequestPage() {
    const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' });
    const [state, setState] = useState<SubmitState>({ kind: 'idle' });

    const update = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm((prev) => ({ ...prev, [key]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (state.kind === 'submitting') return; // 防重复点击
        setState({ kind: 'submitting' });
        try {
            const resp = await fetch('/api/demo-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const payload = await resp.json().catch(() => ({}));
            if (resp.ok) {
                setState({ kind: 'success' });
            } else if (resp.status === 409) {
                setState({ kind: 'error', message: payload.error || '您已提交过演示请求，请勿重复提交' });
            } else if (resp.status === 422 && Array.isArray(payload.details)) {
                setState({ kind: 'error', message: payload.details.join('；') });
            } else {
                setState({ kind: 'error', message: payload.error || '提交失败，请稍后重试' });
            }
        } catch {
            setState({ kind: 'error', message: '网络异常，请稍后重试' });
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-xl p-10">
                <Link href="/pricing" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-8">
                    <ArrowLeft className="w-4 h-4" /> 返回价格方案
                </Link>

                <h1 className="text-2xl font-black text-slate-900 mb-2">预约企业版演示</h1>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    提交后我们的团队会与您联系，安排产品演示与定制化方案沟通。
                </p>

                {state.kind === 'success' ? (
                    <div className="flex flex-col items-center text-center py-10 gap-4">
                        <CheckCircle2 className="w-14 h-14 text-green-500" />
                        <p className="font-bold text-slate-900">演示请求已提交</p>
                        <p className="text-sm text-slate-500">我们会尽快通过您留下的联系方式与您确认演示时间。</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">姓名 *</label>
                            <input
                                type="text" required maxLength={50} value={form.name} onChange={update('name')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder="您的称呼"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">公司名称 *</label>
                            <input
                                type="text" required maxLength={100} value={form.company} onChange={update('company')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder="贵公司全称"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">工作邮箱 *</label>
                            <input
                                type="email" required value={form.email} onChange={update('email')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder="name@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">联系电话（选填）</label>
                            <input
                                type="tel" value={form.phone} onChange={update('phone')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder="便于我们与您确认时间"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">需求说明（选填）</label>
                            <textarea
                                rows={4} maxLength={500} value={form.message} onChange={update('message')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm resize-none"
                                placeholder="例如：项目规模、关注的功能、期望的演示时间"
                            />
                        </div>

                        {state.kind === 'error' && (
                            <p className="text-sm text-red-500 font-medium">{state.message}</p>
                        )}

                        <button
                            type="submit"
                            disabled={state.kind === 'submitting'}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-green-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {state.kind === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {state.kind === 'submitting' ? '提交中…' : '提交演示请求'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
