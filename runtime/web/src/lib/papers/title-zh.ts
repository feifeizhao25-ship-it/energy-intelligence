import titleData from '@/data/paper-title-zh.json';
import type { Paper, SearchResult } from '@/types';

/**
 * 英文论文标题的中文译名。
 * - 译名来自 src/data/paper-title-zh.json（助手翻译，状态「待审核」，未经人工审校）。
 * - 只在能按 arXiv 编号 / DOI / 原文标题精确对上时才附带，对不上就不显示译名，不临时编造。
 * - 译名只是辅助阅读：原文标题和原文链接始终保留。
 */
export interface TitleZhEntry {
  key: string;
  titleOriginal: string;
  titleZh: string;
  sourceUrl?: string;
  reviewStatus: string;
}

const CJK = /[\u4e00-\u9fff]/;

export function hasChinese(text: string | undefined | null): boolean {
  return !!text && CJK.test(text);
}

function normalizeTitle(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

function buildIndex(entries: TitleZhEntry[]) {
  const byKey = new Map<string, TitleZhEntry>();
  const byTitle = new Map<string, TitleZhEntry>();
  for (const entry of entries) {
    if (!entry?.key || !entry.titleZh || !hasChinese(entry.titleZh)) continue;
    byKey.set(entry.key.toLowerCase(), entry);
    if (entry.titleOriginal) byTitle.set(normalizeTitle(entry.titleOriginal), entry);
  }
  return { byKey, byTitle };
}

const defaultIndex = buildIndex(((titleData as { items?: TitleZhEntry[] }).items) || []);

/** 从 id / 链接里取出 arXiv 编号（去掉版本号）。只认 arxiv 链接、arXiv: 前缀或纯编号，避免误匹配 DOI 里的数字。 */
export function arxivIdOf(text: string | undefined | null): string | null {
  if (!text) return null;
  const value = String(text).trim();
  const bare = value.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
  if (bare) return bare[1];
  if (!/arxiv/i.test(value)) return null;
  const match = value.match(/(?<![\d.])(\d{4}\.\d{4,5})(?:v\d+)?(?![\d.])/);
  return match ? match[1] : null;
}

function keysOf(paper: Pick<Paper, 'id' | 'doi' | 'sourceUrl' | 'pdfUrl'>): string[] {
  const keys: string[] = [];
  const arxiv = arxivIdOf(paper.sourceUrl) || arxivIdOf(paper.pdfUrl) || arxivIdOf(String(paper.id ?? ''));
  if (arxiv) keys.push(`arxiv:${arxiv}`);
  if (paper.doi) keys.push(`doi:${paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase()}`);
  return keys;
}

export function lookupTitleZh(
  paper: Pick<Paper, 'id' | 'title' | 'doi' | 'sourceUrl' | 'pdfUrl'>,
  index = defaultIndex,
): TitleZhEntry | null {
  if (hasChinese(paper.title)) return null; // 本来就是中文标题
  for (const key of keysOf(paper)) {
    const hit = index.byKey.get(key);
    if (hit) return hit;
  }
  return index.byTitle.get(normalizeTitle(paper.title || '')) || null;
}

export function withChineseTitle<T extends Paper>(paper: T, index = defaultIndex): T {
  const hit = lookupTitleZh(paper, index);
  if (!hit) return paper;
  return { ...paper, titleZh: hit.titleZh, titleZhStatus: hit.reviewStatus || '待审核' };
}

export function withChineseTitles<R extends Pick<SearchResult, 'papers'>>(result: R): R {
  return { ...result, papers: result.papers.map((paper) => withChineseTitle(paper)) };
}

/** 供国内语料检索：用中文关键词也能命中带译名的英文论文。 */
export function zhTitleSearchText(paper: Pick<Paper, 'id' | 'title' | 'doi' | 'sourceUrl' | 'pdfUrl'>): string {
  return lookupTitleZh(paper)?.titleZh || '';
}

export { buildIndex as buildTitleIndex };
