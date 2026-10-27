'use client';

import { useEffect, useState, type FormEvent } from 'react';

export default function AlertsPage() {
    const [province, setProvince] = useState('上海');
    const [topic, setTopic] = useState('');
    const [email, setEmail] = useState(false);
    const [wecom, setWecom] = useState(false);
    const [message, setMessage] = useState('');
    const [notices, setNotices] = useState<Array<{ id: string; title: string; body: string }>>([]);
    async function load() {
        const response = await fetch('/api/alerts');
        if (!response.ok) return;
        const body = await response.json();
        setNotices(body.data?.notices || []);
    }
    useEffect(() => { load(); }, []);
    async function subscribe(event: FormEvent) {
        event.preventDefault();
        const response = await fetch('/api/alerts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ province, topic, email, wecom }),
        });
        const body = await response.json().catch(() => null);
        setMessage(response.ok ? `已订阅。站内匹配 ${body.data?.matched ?? 0} 条。${body.data?.email || ''}` : (body?.error || '订阅没有完成'));
        if (response.ok) load();
    }
    return <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">政策提醒</h1>
        <form onSubmit={subscribe} className="space-y-2 rounded-xl border p-4">
            <label className="block text-sm">省份<input className="mt-1 w-full rounded border px-3 py-2" value={province} onChange={(event) => setProvince(event.target.value)} /></label>
            <label className="block text-sm">主题或文号<input className="mt-1 w-full rounded border px-3 py-2" value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={email} onChange={(event) => setEmail(event.target.checked)} />邮件（需配置发信，默认不发）</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wecom} onChange={(event) => setWecom(event.target.checked)} />企业微信（需配置应用，默认不发）</label>
            <p className="text-xs text-slate-500">同一用户一小时最多 5 条。未勾选的通道不会外发。</p>
            <button className="rounded-xl bg-slate-900 px-4 py-2 text-white">订阅</button>
            {message && <p className="text-sm text-slate-700">{message}</p>}
        </form>
        <ul className="space-y-2">{notices.map((notice) => <li key={notice.id} className="rounded-xl border p-3"><div className="font-medium">{notice.title}</div><p className="text-sm text-slate-600">{notice.body}</p></li>)}</ul>
    </main>;
}
