'use client';

import { useState } from 'react';
import { formatGbt7714 } from '@/lib/citation/gbt7714';
import { successionLabel } from '@/lib/policy/succession';

/** 政策历史、引用复制和替代关系。没有快照时写未连接。 */
export function PolicyTools({
    title,
    docNumber,
    supersededBy,
}: {
    title: string;
    docNumber?: string | null;
    supersededBy?: string | null;
}) {
    const [copied, setCopied] = useState('');
    const citation = formatGbt7714({ title, docNumber, locator: '待核实' });
    const replaced = successionLabel({ supersededBy });
    async function copy() {
        try {
            await navigator.clipboard.writeText(citation);
            setCopied('已复制引用');
        } catch {
            setCopied(citation);
        }
    }
    return (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <h2 className="font-bold text-slate-900">政策版本与引用</h2>
            <p>历史版本尚未连接。接入快照后在此对照原文。</p>
            {replaced && <p>{replaced}</p>}
            <p className="break-all">{citation}</p>
            <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-white" onClick={copy}>复制引用格式</button>
            {copied && <p>{copied}</p>}
        </section>
    );
}
