'use client';

import { useState } from 'react';
import { fieldsFor, shownNumbers, switchMode, type ReadingMode } from '@/lib/calculator/display-mode';

const SAMPLE = { annualKwh: 12840, lcoe: 0.312, irr: 0.086 };

/** 新手与专业展示同一组测算值。示例数字不是实测。 */
export function ReadingModePanel({ initial = 'beginner' }: { initial?: ReadingMode }) {
    const [mode, setMode] = useState<ReadingMode>(initial);
    const numbers = shownNumbers(mode, SAMPLE);
    const fields = fieldsFor(mode);
    return (
        <section className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[var(--ink)]">阅读模式</h2>
                <span className="rounded-full bg-[var(--paper)] px-2 py-1 text-xs text-[var(--warn)]">示例</span>
                <button type="button" className="rounded-xl bg-[var(--moss)] px-3 py-2 text-sm text-white" onClick={() => setMode((current) => switchMode(current))}>
                    {mode === 'beginner' ? '切换到专业模式' : '切换到新手模式'}
                </button>
            </div>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">{mode === 'beginner' ? '新手模式只列出三个输入。' : '专业模式列出全部假设。'}数值与另一模式相同。</p>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
                {fields.map((field) => <li key={field} className="rounded-lg bg-[var(--paper)] px-2 py-1">{field}</li>)}
            </ul>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {Object.entries(numbers).map(([label, value]) => (
                    <div key={label}>
                        <dt className="text-xs text-[var(--ink-soft)]">{label}</dt>
                        <dd className="tabular-nums text-sm font-semibold">{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
