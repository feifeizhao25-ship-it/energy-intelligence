import type { StoredSource } from './answer-store';

const FRESHNESS: Record<string, string> = {
  current: '现行',
  review_recommended: '建议复核',
  stale: '已过期',
};

export function citationText(answer: string, sources: StoredSource[]): string {
  const blocks = sources.map((source, index) => {
    const lines = [`[${index + 1}] ${source.title}`];
    if (source.publisher) lines.push(`发布机构：${source.publisher}`);
    if (source.published_at) lines.push(`日期：${source.published_at}`);
    if (source.url) lines.push(source.url);
    if (source.locator) lines.push(`定位：${source.locator}`);
    if (source.excerpt) lines.push(`摘录：${source.excerpt}`);
    if (source.freshness_status && FRESHNESS[source.freshness_status]) lines.push(`时效：${FRESHNESS[source.freshness_status]}`);
    if (source.note) lines.push(source.note);
    if (source.license) lines.push(`许可：${source.license}`);
    return lines.join('\n');
  });
  return [answer.trim(), ...blocks].filter(Boolean).join('\n\n');
}
