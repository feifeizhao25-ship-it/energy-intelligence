import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Paper, SearchOptions, SearchResult } from '@/types';

export const DOMESTIC_SOURCE_NOTICE = '未配置国内学术源/未开启境外';

export interface CorpusRecord {
  source: string;
  externalId: string;
  title: string;
  authors?: string;
  year?: number | null;
  doi?: string | null;
  abstract?: string;
  pdfUrl?: string | null;
  licence?: string;
  licenceNote?: string;
  citations?: Array<{ doi?: string; title?: string }>;
}

export function isCnEdition(): boolean {
  return (process.env.NEXT_PUBLIC_APP_EDITION || process.env.APP_EDITION || '').toLowerCase() === 'cn';
}

/** 境外实时检索必须同时打开开关并确认隐私披露。默认关闭。 */
export function overseasLiveEnabled(): boolean {
  const live = process.env.OVERSEAS_LIVE === '1' || process.env.NENGJIAN_OVERSEAS_LIVE === '1';
  const acknowledged = process.env.OVERSEAS_PRIVACY_ACK === '1';
  return live && acknowledged;
}

export function readLiteratureCache(path = process.env.NENGJIAN_LITERATURE_CACHE): CorpusRecord[] {
  const file = path && path.trim()
    ? path
    : join(process.cwd(), 'src/data/literature-cache.json');
  try {
    const payload = JSON.parse(readFileSync(file, 'utf8'));
    const rows = Array.isArray(payload?.records) ? payload.records : [];
    return rows.filter((row: CorpusRecord) => row && typeof row.title === 'string' && row.title.trim());
  } catch {
    return [];
  }
}

export function searchCorpus(records: CorpusRecord[], query: string, options: SearchOptions = {}): Paper[] {
  const needle = query.trim().toLowerCase();
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const matched = records.filter((record) => {
    const haystack = `${record.title} ${record.abstract || ''} ${record.authors || ''} ${record.doi || ''}`.toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
    if (options.yearFrom !== undefined && !(record.year != null && record.year >= options.yearFrom)) return false;
    if (options.yearTo !== undefined && !(record.year != null && record.year <= options.yearTo)) return false;
    if (options.openAccess && !record.pdfUrl) return false;
    return true;
  });
  return matched.slice(offset, offset + limit).map(toPaper);
}

export function toPaper(record: CorpusRecord): Paper {
  return {
    id: record.externalId || record.doi || record.title,
    title: record.title,
    authors: record.authors ? record.authors.split(/[;,]/).map((name) => name.trim()).filter(Boolean) : [],
    year: record.year ?? null,
    abstract: record.abstract || '',
    citationCount: null,
    doi: record.doi || undefined,
    pdfUrl: record.pdfUrl || undefined,
    sourceProvider: record.source,
    licence: record.licence || '',
    licenceNote: record.licenceNote || '',
  };
}

export function domesticSearchResult(records: CorpusRecord[], query: string, options: SearchOptions = {}): SearchResult & { notice?: string; code?: string } {
  if (!records.length) {
    return {
      total: 0,
      totalScope: 'retrieved_window',
      papers: [],
      providers: [{ name: '国内学术语料', status: 'unavailable' }],
      notice: DOMESTIC_SOURCE_NOTICE,
      code: 'DOMESTIC_ACADEMIC_SOURCE_UNCONFIGURED',
    };
  }
  const papers = searchCorpus(records, query, { ...options, offset: 0, limit: records.length });
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 10;
  return {
    total: papers.length,
    totalScope: 'retrieved_window',
    papers: papers.slice(offset, offset + limit),
    providers: [{ name: '国内学术语料', status: 'available' }],
    notice: papers.length ? '结果来自已入库的国内语料，不是实时境外检索。' : '国内语料中没有匹配记录。',
  };
}

export function citationEdges(records: CorpusRecord[]) {
  const byDoi = new Map<string, CorpusRecord>();
  const byTitle = new Map<string, CorpusRecord>();
  for (const record of records) {
    if (record.doi) byDoi.set(record.doi.toLowerCase(), record);
    byTitle.set(normalize(record.title), record);
  }
  const nodes = records.map((record) => ({
    id: record.externalId || record.doi || record.title,
    title: record.title,
    doi: record.doi || null,
    year: record.year ?? null,
    source: record.source,
    licence: record.licence || '',
  }));
  const edges: Array<{ from: string; to: string; doi: string | null }> = [];
  for (const record of records) {
    const from = record.externalId || record.doi || record.title;
    for (const citation of record.citations || []) {
      const target = (citation.doi && byDoi.get(citation.doi.toLowerCase()))
        || (citation.title && byTitle.get(normalize(citation.title)));
      if (!target) continue;
      edges.push({
        from,
        to: target.externalId || target.doi || target.title,
        doi: citation.doi || target.doi || null,
      });
    }
  }
  return { nodes, edges };
}

function normalize(title: string) {
  return title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
