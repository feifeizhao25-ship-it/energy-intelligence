import { AIGC_LABEL, AIGC_SHORT_LABEL } from '@/lib/ai/aigc';

/**
 * AI 生成内容的显式标识。凡是页面上展示模型生成的文字（对话、摘要、翻译、诊断、投资分析……），
 * 紧挨内容放一个：compact 是小徽标，默认是带完整提示语的一行。
 */
export function AigcLabel({ compact = false, tone = 'light' }: { compact?: boolean; tone?: 'light' | 'dark' }) {
    const color = tone === 'dark' ? 'text-slate-300 bg-slate-700/60 border-slate-600' : 'text-slate-600 bg-slate-100 border-slate-200';
    if (compact) {
        return (
            <span role="note" data-aigc="true" className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
                {AIGC_SHORT_LABEL}
            </span>
        );
    }
    return (
        <p role="note" data-aigc="true" className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${color}`}>
            <span className="font-semibold">{AIGC_SHORT_LABEL}</span>
            <span>{AIGC_LABEL}</span>
        </p>
    );
}
