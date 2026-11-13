import 'server-only';

import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { saveAnswer, type StoredAnswer, type StoredSource } from './answer-store';

const UNPUBLISHED = new Set(['待核实', '待审核']);
const BLOCKED_EVIDENCE = new Set(['pending', 'quarantined', 'invalid']);
const SYNTHETIC_HOSTS = new Set(['example.com', 'example.org', 'example.cn', 'example.gov']);

interface LibraryDoc {
  source_id?: string;
  type?: string;
  lang?: string;
  title?: string;
  content?: string;
  status?: string;
  evidence_status?: string;
  published_at?: string;
  publish_date?: string;
  valid_until?: string;
  expiry?: string | null;
  date_kind?: string;
  sign_date?: string;
  effective_date?: string;
  effective_date_stated?: boolean;
  effective_date_basis?: string;
  expiry_date?: string;
  superseded_by?: string;
  primary_checked_at?: string;
  issuer?: string;
  excerpt?: string;
  locator?: string;
  source_url?: string;
  source_org?: string;
  license?: string;
  last_verified_at?: string;
  verify_interval_days?: number;
  doc_number?: string;
}

let cached: LibraryDoc[] | null = null;

function registryPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../backend/data/rag_sources.json'),
    path.resolve(process.cwd(), 'runtime/backend/data/rag_sources.json'),
    path.resolve(__dirname, '../../../../backend/data/rag_sources.json'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function documents(): LibraryDoc[] {
  if (cached) return cached;
  const file = registryPath();
  if (!file) {
    cached = [];
    return cached;
  }
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { sources?: LibraryDoc[] };
  cached = Array.isArray(parsed.sources) ? parsed.sources : [];
  return cached;
}

export function clearLibraryCache(): void {
  cached = null;
}

function parseDay(value?: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function isExpiredPolicy(doc: Pick<LibraryDoc, 'valid_until' | 'expiry_date' | 'expiry' | 'superseded_by'>, today = new Date()): boolean {
  if (doc.superseded_by) return true;
  const days = [doc.valid_until, doc.expiry_date, doc.expiry].map(parseDay).filter((value): value is number => value !== null);
  if (!days.length) return false;
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.min(...days) < now;
}

function blocked(doc: LibraryDoc): boolean {
  return UNPUBLISHED.has(String(doc.status || '')) || BLOCKED_EVIDENCE.has(String(doc.evidence_status || ''));
}

function tokens(text: string): string[] {
  const out: string[] = [];
  for (const word of text.toLowerCase().match(/[a-z0-9][a-z0-9.-]{1,}/g) || []) out.push(word);
  const han = text.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < han.length - 1; i += 1) out.push(han.slice(i, i + 2));
  return out;
}

function allowsOverseas(query: string): boolean {
  if (/美国|海外|境外|IRS|ITC/.test(query)) return true;
  const upper = query.toUpperCase();
  return ['IEC', 'IEEE', 'NREL', 'EIA'].some((marker) => upper.includes(marker));
}

function freshness(doc: LibraryDoc, today = new Date()): string {
  const verified = String(doc.last_verified_at || '');
  const interval = Number(doc.verify_interval_days || 365);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verified)) return 'stale';
  const [year, month, day] = verified.split('-').map(Number);
  const start = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const age = Math.floor((now - start) / 86400000);
  if (age > interval) return 'stale';
  if (age > interval * 0.8) return 'review_recommended';
  return 'current';
}

function hostOf(url: string): string {
  return url.split('//')[1]?.split('/')[0]?.split(':')[0]?.toLowerCase() || '';
}

export function isSyntheticUrl(url?: string): boolean {
  const host = hostOf(url || '');
  return SYNTHETIC_HOSTS.has(host) || host.endsWith('.example.com') || host.endsWith('.example.gov');
}

function reviewNote(doc: LibraryDoc): string | undefined {
  if (isSyntheticUrl(doc.source_url)) return '合成测试数据。不是真实出版物。';
  const evidence = String(doc.evidence_status || '');
  if (evidence === 'auto_extracted') return '审核：机器摘录，未经人工复核，不是已发布文本。';
  if (evidence === 'legacy_unreviewed') return '审核状态：没有人工复核记录。';
  return undefined;
}

function excerpt(text: string): string | undefined {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return undefined;
  if (raw.length <= 180) return raw;
  const cut = raw.slice(0, 180);
  const space = cut.lastIndexOf(' ');
  return space > 40 ? cut.slice(0, space) : cut.trimEnd();
}

function toSource(doc: LibraryDoc): StoredSource {
  return {
    title: String(doc.title || '未命名来源'),
    url: doc.source_url || undefined,
    publisher: doc.source_org || undefined,
    issuer: doc.issuer || undefined,
    published_at: doc.published_at || undefined,
    publish_date: doc.publish_date || undefined,
    date_kind: doc.date_kind || undefined,
    sign_date: doc.sign_date || undefined,
    effective_date: doc.effective_date || undefined,
    effective_date_stated: typeof doc.effective_date_stated === 'boolean' ? doc.effective_date_stated : undefined,
    effective_date_basis: doc.effective_date_basis || undefined,
    expiry_date: doc.expiry_date || undefined,
    superseded_by: doc.superseded_by || undefined,
    primary_checked_at: doc.primary_checked_at || undefined,
    locator: doc.locator || undefined,
    excerpt: doc.excerpt || excerpt(String(doc.content || '')),
    freshness_status: freshness(doc),
    evidence_status: doc.evidence_status || undefined,
    status: doc.status || undefined,
    license: doc.license || undefined,
    note: reviewNote(doc),
  };
}

export function searchLibrary(query: string, market: 'cn' | 'en' = 'cn'): StoredSource[] {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return [];
  const overseas = allowsOverseas(query);
  const ranked = documents()
    .filter((doc) => !blocked(doc) && !isExpiredPolicy(doc))
    .filter((doc) => (market === 'cn' && !overseas ? doc.lang === 'cn' : true))
    .map((doc) => {
      const hay = tokens([doc.title, doc.content, doc.doc_number, doc.locator].filter(Boolean).join(' '));
      const hit = new Set(hay);
      const score = queryTokens.reduce((sum, token) => sum + (hit.has(token) ? 1 : 0), 0);
      return { doc, score };
    })
    .filter((row) => row.score >= 2 && row.score / queryTokens.length >= 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  return ranked.map((row) => toSource(row.doc));
}

export function libraryStandIn(query: string): { text: string; sources: StoredSource[]; synthetic: boolean } {
  const sources = searchLibrary(query, 'cn');
  const synthetic = sources.some((source) => isSyntheticUrl(source.url));
  if (!sources.length) {
    return { text: '没有可引用的来源，不能回答这个问题。未调用模型。', sources, synthetic: false };
  }
  const issued = sources
    .map((source) => (source.publish_date ? `发文日期：${source.publish_date}。` : ''))
    .filter(Boolean)
    .join('');
  const lead = synthetic
    ? '合成测试数据。不是真实出版物。未调用模型。下面只列资料库命中，不是模型结论。'
    : '未调用模型。下面只列资料库命中，不是模型结论。';
  const text = issued ? `${lead}\n${issued}` : lead;
  return { text, sources, synthetic };
}

export function storeLibraryStandIn(userId: string, query: string): StoredAnswer {
  const reply = libraryStandIn(query);
  return saveAnswer({ userId, text: reply.text, sources: reply.sources, standIn: true, synthetic: reply.synthetic });
}
