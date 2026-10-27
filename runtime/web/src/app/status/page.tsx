'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface StatusBody {
    api?: string;
    checkedAt?: string;
    payments?: { alipayConfigured?: boolean; wechatConfigured?: boolean };
    models?: { domesticConfigured?: boolean };
    policy?: { approvedCount?: number | null; updatedAt?: string | null };
    resourceCacheUpdatedAt?: string | null;
    heartbeat?: { level?: string; lastSeen?: string | null; note?: string };
}

export default function StatusPage() {
    const [data, setData] = useState<StatusBody | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        fetch('/api/status').then((response) => response.json()).then((body) => {
            setData(body.data || null);
        }).catch(() => setError('状态暂时无法读取'));
    }, []);
    const yes = (value?: boolean) => value ? '已配置' : '未配置';
    return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 px-4 py-10 text-slate-900">
        <p className="text-sm text-slate-500">新能源智库</p>
        <h1 className="mt-2 text-3xl font-black">服务状态</h1>
        <p className="mt-2 text-sm text-slate-600">这里只显示是否已配置和最近更新时间，不显示密钥，也不编造在线率。</p>
        <Link href="/" className="mt-3 inline-block text-sm font-bold text-emerald-700">返回首页</Link>
        {error && <p className="mt-6 text-sm text-rose-700">{error}</p>}
        {data && <dl className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <div className="flex justify-between gap-4"><dt>接口</dt><dd>{data.api === 'ok' ? '可访问' : '未知'}</dd></div>
            <div className="flex justify-between gap-4"><dt>检查时间</dt><dd>{data.checkedAt || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt>支付宝</dt><dd>{yes(data.payments?.alipayConfigured)}</dd></div>
            <div className="flex justify-between gap-4"><dt>微信支付</dt><dd>{yes(data.payments?.wechatConfigured)}</dd></div>
            <div className="flex justify-between gap-4"><dt>国内模型</dt><dd>{yes(data.models?.domesticConfigured)}</dd></div>
            <div className="flex justify-between gap-4"><dt>已审政策</dt><dd>{data.policy?.approvedCount ?? '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt>政策更新</dt><dd>{data.policy?.updatedAt || '—'}</dd></div>
            <div className="flex justify-between gap-4"><dt>资源缓存</dt><dd>{data.resourceCacheUpdatedAt || '未放置'}</dd></div>
            <div className="flex justify-between gap-4"><dt>心跳</dt><dd>{data.heartbeat?.note || '—'}</dd></div>
        </dl>}
    </main>;
}
