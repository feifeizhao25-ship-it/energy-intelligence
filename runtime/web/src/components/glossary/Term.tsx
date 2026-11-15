'use client';

import { findTerm } from '@/lib/glossary/lookup';

/** 术语悬浮解释。条目仍待企业微信核对，所以标出审核状态。 */
export function Term({ name, open = false }: { name: string; open?: boolean }) {
    const term = findTerm(name);
    return (
        <span className="group relative inline-block border-b border-dotted border-[var(--moss)]" tabIndex={0}>
            {name}
            <span
                role="tooltip"
                className={`${open ? 'block' : 'hidden group-hover:block group-focus:block'} absolute left-0 z-10 mt-1 w-64 rounded-xl border border-[var(--line)] bg-white p-3 text-xs leading-5 text-[var(--ink)] shadow-sm`}
            >
                {term ? `${term.short}。例如：${term.example}。截至 ${term.as_of}。出处待核对。` : '术语表里还没有这一条。'}
            </span>
        </span>
    );
}
