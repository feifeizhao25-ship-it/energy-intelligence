'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { formatGbt7714 } from '@/lib/citation/gbt7714';
import { successionLabel } from '@/lib/policy/succession';

interface PolicyRow {
    id?: string;
    source_id?: string;
    region?: string;
    sourceTitle?: string | null;
    title?: string;
    docNumber?: string | null;
    doc_number?: string;
    type?: string;
    source_url?: string;
}

interface CohortGroup {
    province: string;
    role: string;
    count: number;
    items: string[];
}

interface ProvinceField {
    display?: string;
    value?: string | null;
    source_url?: string | null;
    as_of?: string | null;
}

interface ProvinceRow {
    province: string;
    fields: Record<string, ProvinceField>;
}

/** 政策历史、按日期回看、同类浏览和引用复制。没有快照时写未连接，示例数据会标明。 */
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
    const [asOf, setAsOf] = useState('2026-10-27');
    const [query, setQuery] = useState('');
    const [rows, setRows] = useState<PolicyRow[]>([]);
    const [note, setNote] = useState('正在读取政策。');
    const [cohorts, setCohorts] = useState<CohortGroup[]>([]);
    const [cohortNote, setCohortNote] = useState('');
    const [provinces, setProvinces] = useState<ProvinceRow[]>([]);
    const [provinceName, setProvinceName] = useState('山东');
    const [provinceNote, setProvinceNote] = useState('');
    const citation = formatGbt7714({ title, docNumber, locator: '待核实' });
    const replaced = successionLabel({ supersededBy });

    async function load(event?: FormEvent) {
        event?.preventDefault();
        const response = await fetch(`/api/policies?q=${encodeURIComponent(query)}&asOf=${encodeURIComponent(asOf)}`);
        const body = await response.json().catch(() => null);
        setRows(body?.data || []);
        setNote(body?.note || '检索没有完成');
    }

    useEffect(() => {
        void load();
        void fetch('/api/policies/cohorts').then((response) => response.json()).then((body) => {
            setCohorts(body.groups || []);
            setCohortNote(body.note || '');
        }).catch(() => setCohortNote('同类浏览未连接'));
        void fetch('/api/provinces').then((response) => response.json()).then((body) => {
            setProvinces(body.provinces || []);
            setProvinceNote(body.note || '');
        }).catch(() => setProvinceNote('省级档案未连接'));
        // 首次进入页面就拉取，避免空白列表。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function copy() {
        try {
            await navigator.clipboard.writeText(citation);
            setCopied('已复制引用');
        } catch {
            setCopied(citation);
        }
    }

    const province = provinces.find((item) => item.province === provinceName) || provinces[0];
    return (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <h2 className="font-bold text-slate-900">政策版本与引用</h2>
            <p>历史快照库未连接时，按日期回看只使用已审核记录或标明的示例条目。</p>
            {replaced && <p>{replaced}</p>}
            <p className="break-all">{citation}</p>
            <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-white" onClick={copy}>复制引用格式</button>
            {copied && <p>{copied}</p>}

            <form onSubmit={load} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <label className="text-xs">
                    关键词
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="省份、文号或标题" className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
                </label>
                <label className="text-xs">
                    回看日期
                    <input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
                </label>
                <button className="self-end rounded-xl bg-slate-900 px-4 py-2 text-white">按日期回看</button>
            </form>
            <p>{note}</p>
            <ul className="space-y-2">
                {rows.map((row) => {
                    const name = row.sourceTitle || row.title || row.type || '未命名条目';
                    const number = row.docNumber || row.doc_number || '';
                    return (
                        <li key={row.id || row.source_id || name} className="rounded-xl border p-3">
                            <div className="font-medium break-words">{name}</div>
                            <div className="text-sm text-slate-600">{row.region || ''} {number}</div>
                            {row.source_url ? <a className="break-all underline" href={row.source_url} target="_blank" rel="noopener noreferrer">原文</a> : null}
                        </li>
                    );
                })}
                {rows.length === 0 && <li className="text-sm text-slate-500">这一天没有匹配的生效条目。</li>}
            </ul>

            <div>
                <h3 className="font-bold text-slate-900">同类浏览</h3>
                <p>{cohortNote}</p>
                <ul className="mt-2 space-y-1">
                    {cohorts.map((group) => (
                        <li key={`${group.province}-${group.role}`}>{group.province} · {group.role} · {group.count} 人 · {group.items.join('、')}</li>
                    ))}
                    {cohorts.length === 0 && <li>没有达到展示人数的分组。</li>}
                </ul>
            </div>

            <div>
                <h3 className="font-bold text-slate-900">省级档案</h3>
                <p>{provinceNote}</p>
                <label className="mt-2 block text-xs">
                    省份
                    <select value={province?.province || provinceName} onChange={(event) => setProvinceName(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
                        {provinces.map((item) => <option key={item.province}>{item.province}</option>)}
                    </select>
                </label>
                <dl className="mt-2 space-y-1">
                    {province && Object.entries(province.fields).map(([name, field]) => (
                        <div key={name} className="grid grid-cols-1 gap-1 sm:grid-cols-[8rem_1fr]">
                            <dt className="text-slate-500">{name}</dt>
                            <dd className="break-words">{field.display || field.value || '待核实'}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
}
