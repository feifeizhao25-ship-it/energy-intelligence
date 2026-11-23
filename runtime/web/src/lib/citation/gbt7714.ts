export interface CitationFields {
    authors?: string | null;
    title: string;
    source?: string | null;
    year?: string | null;
    docNumber?: string | null;
    locator?: string | null;
}

const PLACEHOLDER = new Set(['', '待核实', '政策原文', '未命名条目']);

/** 标题和至少一项出处都齐，才生成引用。空字段不拼成一串待核实。 */
export function citationFieldsReady(item: CitationFields): boolean {
    const title = item.title?.trim() || '';
    if (!title || PLACEHOLDER.has(title)) return false;
    return [item.authors, item.source, item.year, item.docNumber].some((value) => {
        const text = value?.trim() || '';
        return Boolean(text) && !PLACEHOLDER.has(text);
    });
}

/**
 * 引用格式依据 GB/T 7714-2025《信息与文献 参考文献著录规则》（2026-07-01 实施，代替 GB/T 7714-2015）。
 * TODO(待定47)：2025 版正文需要购买，本次没有逐条对照新版著录细则，只改了标准编号和文献类型标识；
 * 细则差异等拿到正式文本后再核对。
 */
export const CITATION_STANDARD = 'GB/T 7714-2025';

const STANDARD_NO_RE = /^(GB|GB\/T|GB\/Z|NB|NB\/T|DL|DL\/T|JGJ|CJJ|IEC|ISO|IEEE)\s*[\d.]+/i;

/** 文献类型标识：标准用 [S]，其余（政策文件等）用 [Z]。 */
export function documentTypeCode(item: CitationFields): 'S' | 'Z' {
    return STANDARD_NO_RE.test(item.docNumber?.trim() || '') ? 'S' : 'Z';
}

/** GB/T 7714 顺序编码的可复制条目。缺字段写待核实，不补作者或年份。 */
export function formatGbt7714(item: CitationFields): string {
    const authors = item.authors?.trim() || '待核实';
    const source = item.source?.trim() || '待核实';
    const year = item.year?.trim() || '待核实';
    const locator = item.locator?.trim() ? `: ${item.locator.trim()}` : '';
    if (documentTypeCode(item) === 'S') {
        // 标准：题名: 标准号[S]
        return `${authors}. ${item.title}: ${item.docNumber!.trim()}[S]. ${source}, ${year}${locator}.`;
    }
    const number = item.docNumber?.trim() ? `. ${item.docNumber.trim()}` : '';
    return `${authors}. ${item.title}[Z]. ${source}, ${year}${number}${locator}.`;
}
