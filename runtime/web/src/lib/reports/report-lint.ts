import { findBottomLineViolations, findParaphraseViolations } from '@/lib/compliance/bottom-line';

export interface ReportLint {
    ok: boolean;
    missing: string[];
}

/** 缺任一项就拒绝下载。底线命中同样拒绝。 */
export function lintReport(text: string): ReportLint {
    const missing: string[] = [];
    if (!text.includes('不构成投资建议')) missing.push('免责声明');
    if (!/1\.\s/.test(text) || !/1\.1/.test(text)) missing.push('目录编号');
    if (!text.includes('图') && !text.includes('本示例无图') && !text.includes('本题无图')) missing.push('图表引用');
    if (!/[千兆瓦时kWhMW]/.test(text) || !text.includes('来源')) missing.push('单位与来源');
    if (!text.includes('人工智能生成合成')) missing.push('生成合成标识');
    if (findBottomLineViolations(text).length || findParaphraseViolations(text).length) missing.push('底线措辞');
    return { ok: missing.length === 0, missing };
}
