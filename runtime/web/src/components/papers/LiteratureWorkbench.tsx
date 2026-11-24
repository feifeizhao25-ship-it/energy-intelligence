'use client';

import { useState } from 'react';
import { formulaHtml, reportFormula } from '@/lib/ai/formula-html';
import 'katex/dist/katex.min.css';

type Paper = {
    title?: string;
    abstract?: string;
    year?: number;
    url?: string;
    conclusion?: string;
    method?: string;
    dataDefinition?: string;
    boundary?: string;
};

export function LiteratureWorkbench() {
    const [query, setQuery] = useState('光伏 平准化度电成本');
    const [papers, setPapers] = useState<Paper[]>([]);
    const [note, setNote] = useState('检索结果只展示来源里已有的字段。缺字段标成待审核，不补写结论。');
    const formula = reportFormula('solar');

    async function search() {
        const response = await fetch('/api/papers/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, options: { limit: 5 } }),
        });
        if (!response.ok) {
            setNote('文献检索暂时不可用。下面只保留方法公式，不编造论文结论。');
            setPapers([]);
            return;
        }
        const body = await response.json();
        const rows = (body.papers || body.data?.papers || []) as Paper[];
        setPapers(rows.slice(0, 5));
        setNote(rows.length ? `返回 ${rows.length} 条，结构化字段缺失处标为待审核。` : '这次没有返回文献。');
    }

    return (
        <section className="mb-6 space-y-3 rounded-2xl border border-[var(--line)] p-4" data-testid="literature-workbench">
            <h2 className="text-lg font-semibold">文献分析</h2>
            <p className="text-sm leading-6">拆解核心结论、研究方法、数据口径和适用边界。导出包只含检索到的字段，并带待审核标记。</p>
            <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: formulaHtml(formula.latex, true) }} />
            <div className="flex flex-wrap gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" aria-label="文献检索" />
                <button type="button" className="rounded-xl bg-[var(--moss)] px-3 py-2 text-sm text-white" onClick={() => void search()}>检索</button>
            </div>
            <p className="text-sm text-[var(--ink-soft)]">{note}</p>
            <ul className="space-y-3">
                {papers.map((paper) => (
                    <li key={paper.title} className="rounded-2xl border p-3 text-sm leading-6">
                        <h3 className="font-semibold">{paper.title}</h3>
                        <p>核心结论：{paper.conclusion || paper.abstract || '待审核'}</p>
                        <p>研究方法：{paper.method || '待审核'}</p>
                        <p>数据口径：{paper.dataDefinition || '待审核'}</p>
                        <p>适用边界：{paper.boundary || '待审核'}</p>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">待审核</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
