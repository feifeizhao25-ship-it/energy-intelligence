'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale } from 'next-intl';

type SubmitState =
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'success' }
    | { kind: 'error'; message: string };

export default function DemoRequestPage() {
    const isEnglish = useLocale() === 'en';
    const copy = isEnglish ? {
        back: 'Back to plans', title: 'Request a commercial review', intro: 'Tell us the minimum information needed to scope regional terms, data residency, integrations, and support. Do not submit confidential project files.',
        success: 'Request received', successBody: 'The team will use the contact details you provided to confirm scope and scheduling.', name: 'Name *', namePlaceholder: 'Your name', company: 'Organization *', companyPlaceholder: 'Organization name', email: 'Work email *', phone: 'Phone (optional)', phonePlaceholder: 'Include country code', message: 'Requirements (optional)', messagePlaceholder: 'Region, organization size, required integrations, and preferred timing', submit: 'Submit request', submitting: 'Submitting…', consent: 'I agree to the Privacy Policy and consent to the use of these details to respond to this request.', consentError: 'Accept the Privacy Policy before submitting.', duplicate: 'A pending request already exists for this email.', validation: 'Check the required fields and try again.', failed: 'The request could not be submitted. Please try again.', network: 'Network error. Please try again.',
    } : {
        back: '返回价格方案', title: '预约企业方案沟通', intro: '请填写评估方案所需的最少信息，不要在首次申请中提交项目机密文件。',
        success: '申请已提交', successBody: '我们会使用您提供的联系方式确认需求范围和沟通时间。', name: '姓名 *', namePlaceholder: '您的称呼', company: '公司名称 *', companyPlaceholder: '贵公司全称', email: '工作邮箱 *', phone: '联系电话（选填）', phonePlaceholder: '便于确认时间', message: '需求说明（选填）', messagePlaceholder: '例如：项目规模、所需接口和期望沟通时间', submit: '提交申请', submitting: '提交中…', consent: '我同意隐私政策，并同意平台使用上述联系方式回复本次申请。', consentError: '请先阅读并同意隐私政策。', duplicate: '该邮箱已有待处理申请，请勿重复提交。', validation: '请检查必填字段后重试。', failed: '提交失败，请稍后重试。', network: '网络异常，请稍后重试。',
    };
    const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' });
    const [state, setState] = useState<SubmitState>({ kind: 'idle' });
    const [accepted, setAccepted] = useState(false);

    const update = (key: keyof typeof form) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm((prev) => ({ ...prev, [key]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (state.kind === 'submitting') return; // 防重复点击
        if (!accepted) return setState({ kind: 'error', message: copy.consentError });
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
                setState({ kind: 'error', message: isEnglish ? copy.duplicate : (payload.error || copy.duplicate) });
            } else if (resp.status === 422 && Array.isArray(payload.details)) {
                setState({ kind: 'error', message: isEnglish ? copy.validation : payload.details.join('；') });
            } else {
                setState({ kind: 'error', message: isEnglish ? copy.failed : (payload.error || copy.failed) });
            }
        } catch {
            setState({ kind: 'error', message: copy.network });
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-100 shadow-xl p-10">
                <Link href="/pricing" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-8">
                    <ArrowLeft className="w-4 h-4" /> {copy.back}
                </Link>

                <h1 className="text-2xl font-black text-slate-900 mb-2">{copy.title}</h1>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                    {copy.intro}
                </p>

                {state.kind === 'success' ? (
                    <div className="flex flex-col items-center text-center py-10 gap-4">
                        <CheckCircle2 className="w-14 h-14 text-green-500" />
                        <p className="font-bold text-slate-900">{copy.success}</p>
                        <p className="text-sm text-slate-500">{copy.successBody}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{copy.name}</label>
                            <input
                                type="text" required maxLength={50} value={form.name} onChange={update('name')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder={copy.namePlaceholder}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{copy.company}</label>
                            <input
                                type="text" required maxLength={100} value={form.company} onChange={update('company')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder={copy.companyPlaceholder}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{copy.email}</label>
                            <input
                                type="email" required value={form.email} onChange={update('email')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder="name@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{copy.phone}</label>
                            <input
                                type="tel" value={form.phone} onChange={update('phone')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm"
                                placeholder={copy.phonePlaceholder}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">{copy.message}</label>
                            <textarea
                                rows={4} maxLength={500} value={form.message} onChange={update('message')}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none text-sm resize-none"
                                placeholder={copy.messagePlaceholder}
                            />
                        </div>

                        <label className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); if (event.target.checked && state.kind === 'error') setState({ kind: 'idle' }); }} className="mt-1 h-4 w-4 accent-green-600" /><span>{copy.consent} <Link href="/privacy" target="_blank" className="font-bold text-green-700">{isEnglish ? 'Privacy Policy' : '查看隐私政策'}</Link></span></label>

                        {state.kind === 'error' && (
                            <p className="text-sm text-red-500 font-medium">{state.message}</p>
                        )}

                        <button
                            type="submit"
                            disabled={state.kind === 'submitting'}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-green-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {state.kind === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {state.kind === 'submitting' ? copy.submitting : copy.submit}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
