import type { StoredSource } from './answer-store';

const FRESHNESS: Record<string, string> = {
  current: '现行',
  review_recommended: '建议复核',
  stale: '已过期',
};

export function dateLines(source: StoredSource): string[] {
  const lines: string[] = [];
  const published = source.published_at;
  if (source.date_kind === 'pdf_creation' && published) {
    lines.push(`PDF文件元数据日期（CreationDate）：${published}。印刷发布日期：未知。`);
  } else if (source.date_kind === 'page_release' && published) {
    lines.push(`页面发布时间：${published}。`);
  } else if (source.date_kind === 'printed_on_page' && published) {
    lines.push(`页面所印日期：${published}。`);
  } else if (published) {
    lines.push(`记录中的日期：${published}。日期类型：未标明。`);
  }
  if (source.publish_date) lines.push(`发文日期：${source.publish_date}。`);
  if (source.sign_date) lines.push(`落款日期：${source.sign_date}。`);
  if (source.effective_date_stated === true && source.effective_date) {
    lines.push(`生效日：${source.effective_date}。${source.effective_date_basis || ''}`.trim());
  } else if (source.effective_date_stated === false) {
    lines.push(`生效日：原文未写单一施行日。${source.effective_date_basis || ''}`.trim());
  }
  if (source.expiry_date) lines.push(`记录中的届满日：${source.expiry_date}。`);
  if (source.superseded_by) lines.push(`记录写明被替代：${source.superseded_by}。`);
  if (source.primary_checked_at) lines.push(`对照原文阅读：${source.primary_checked_at}。这不是人工审核。`);
  return lines;
}

export function citationText(answer: string, sources: StoredSource[]): string {
  const blocks = sources.map((source, index) => {
    const lines = [`[${index + 1}] ${source.title}`];
    if (source.publisher) lines.push(`发布机构：${source.publisher}`);
    if (source.issuer && source.issuer !== source.publisher) lines.push(`发文机关：${source.issuer}`);
    lines.push(...dateLines(source));
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
