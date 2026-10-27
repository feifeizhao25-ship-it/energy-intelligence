export interface CitationFields {
    authors?: string | null;
    title: string;
    source?: string | null;
    year?: string | null;
    docNumber?: string | null;
    locator?: string | null;
}

/** GB/T 7714 顺序编码的可复制条目。缺字段写待核实，不补作者或年份。 */
export function formatGbt7714(item: CitationFields): string {
    const authors = item.authors?.trim() || '待核实';
    const source = item.source?.trim() || '待核实';
    const year = item.year?.trim() || '待核实';
    const number = item.docNumber?.trim() ? `. ${item.docNumber.trim()}` : '';
    const locator = item.locator?.trim() ? `: ${item.locator.trim()}` : '';
    return `${authors}. ${item.title}[Z]. ${source}, ${year}${number}${locator}.`;
}
