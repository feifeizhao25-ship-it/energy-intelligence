'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Download, Loader2, Trash2 } from 'lucide-react';

/** 导出个人数据 / 注销账号（设置页）。 */
export function AccountDataPanel({ phone }: { phone?: string }) {
    const [step, setStep] = useState<'idle' | 'confirm'>('idle');
    const [code, setCode] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    async function sendCode() {
        if (!phone) { setMessage('当前账号没有绑定手机号，请联系客服注销'); return; }
        setBusy(true); setMessage(null);
        try {
            const res = await fetch('/api/auth/sms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
            const data = await res.json().catch(() => ({}));
            setMessage(res.ok ? `验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(-4)}` : data.error || '发送失败');
            if (res.ok) setStep('confirm');
        } finally { setBusy(false); }
    }

    async function erase() {
        setBusy(true); setMessage(null);
        try {
            const res = await fetch('/api/user/account', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, confirm }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { setMessage(data.error || '注销失败'); return; }
            setMessage(data.message);
            await signOut({ callbackUrl: '/' });
        } finally { setBusy(false); }
    }

    return (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 space-y-5">
            <h4 className="font-black text-sm text-slate-900">个人数据与账号</h4>
            <a href="/api/user/export" className="flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline">
                <Download className="w-4 h-4" />导出我的全部数据（JSON）
            </a>
            <div className="border-t border-slate-100 pt-5">
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    注销后，项目、测算、电站、文献、对话等个人数据将被删除，账号不可恢复。
                    付款记录作为财务凭证依法保留，并与你的个人信息解除关联。
                </p>
                {step === 'idle' ? (
                    <button type="button" onClick={sendCode} disabled={busy} className="flex items-center gap-2 text-sm font-bold text-rose-600 disabled:opacity-50">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}注销账号
                    </button>
                ) : (
                    <div className="space-y-3">
                        <input value={code} onChange={(e) => setCode(e.target.value.trim())} inputMode="numeric" maxLength={6} placeholder="短信验证码" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="输入「确认注销」" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <button type="button" onClick={erase} disabled={busy || code.length !== 6 || confirm !== '确认注销'} className="w-full rounded-xl bg-rose-600 py-2 text-sm font-bold text-white disabled:opacity-40">
                            {busy ? '处理中…' : '永久注销'}
                        </button>
                    </div>
                )}
                {message && <p role="status" className="mt-3 text-xs text-slate-600">{message}</p>}
            </div>
        </div>
    );
}
