'use client';

import { cn } from '@/lib/utils';

export type SignupSourceOption = { code: string; label: string };

/** 只保留形如 {code, label} 的选项；接口没打开或回了别的东西，就当没有这道题。 */
export function parseSignupSourceOptions(raw: unknown): SignupSourceOption[] {
    const r = raw as { enabled?: unknown; options?: unknown } | null;
    if (!r || r.enabled !== true || !Array.isArray(r.options)) return [];
    return r.options.filter(
        (o): o is SignupSourceOption =>
            !!o && typeof (o as SignupSourceOption).code === 'string' && typeof (o as SignupSourceOption).label === 'string',
    );
}

/** 只有当前选中的、且在选项里的代码才提交；否则提交空（等于跳过）。 */
export function selectedSignupSource(options: SignupSourceOption[], value: string): string | undefined {
    return value && options.some((o) => o.code === value) ? value : undefined;
}

/**
 * 注册来源题「从哪知道我们」：可跳过的单选。再点一次已选项即取消。
 * 没有选项（开关关闭、国际版或接口失败）时整块不显示。
 */
export default function SignupSourcePicker({
    options,
    value,
    onChange,
}: {
    options: SignupSourceOption[];
    value: string;
    onChange: (code: string) => void;
}) {
    if (!options.length) return null;
    return (
        <fieldset data-testid="signup-source" className="mb-6">
            <legend className="mb-3 text-sm font-bold text-slate-300">从哪知道我们（选填，可跳过）</legend>
            <div role="radiogroup" aria-label="从哪知道我们" className="flex flex-wrap gap-2">
                {options.map((o) => {
                    const selected = o.code === value;
                    return (
                        <button
                            key={o.code}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            data-testid={`signup-source-${o.code}`}
                            onClick={() => onChange(selected ? '' : o.code)}
                            className={cn(
                                'rounded-full border-2 px-3 py-1.5 text-sm transition-all',
                                selected
                                    ? 'border-green-500 bg-green-500/10 text-green-400'
                                    : 'border-slate-700 bg-slate-800/50 text-slate-200 hover:border-slate-600',
                            )}
                        >
                            {o.label}
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}
