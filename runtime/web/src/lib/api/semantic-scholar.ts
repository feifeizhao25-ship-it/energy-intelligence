import { Paper, SearchOptions, SearchResult } from '@/types';

const BASE_URL = 'https://api.semanticscholar.org/graph/v1';
const PAPER_FIELDS = 'paperId,title,authors,year,abstract,citationCount,venue,url,openAccessPdf,externalIds,tldr';

function headers(): HeadersInit {
  const value: HeadersInit = { Accept: 'application/json' };
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) value['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  return value;
}

async function fetchJson(url: string, retries = 2): Promise<any> {
  let delay = 750;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(10000) });
      if (response.ok) return await response.json();
      if (response.status !== 429 || attempt === retries) {
        throw new Error(`Semantic Scholar request failed (${response.status})`);
      }
    } catch (error) {
      if (attempt === retries) {
        throw new Error('Semantic Scholar 数据暂时不可用，未返回任何替代或模拟论文', { cause: error });
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 2;
  }
  throw new Error('Semantic Scholar 数据暂时不可用');
}

function mapPaper(value: any): Paper {
  if (!value?.paperId || !value?.title || !value?.url) {
    throw new Error('Semantic Scholar returned an incomplete paper record');
  }
  return {
    id: value.paperId,
    title: value.title,
    authors: value.authors?.map((author: any) => author.name).filter(Boolean) || [],
    year: value.year ?? null,
    abstract: value.abstract || '',
    citationCount: value.citationCount ?? null,
    pdfUrl: value.openAccessPdf?.url,
    tldr: value.tldr?.text,
    venue: value.venue,
    doi: value.externalIds?.DOI,
    sourceProvider: 'Semantic Scholar',
    sourceUrl: value.url,
    retrievedAt: new Date().toISOString(),
    evidenceStatus: 'provider_verified',
  };
}

export async function searchPapers(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const normalized = query.trim();
  if (!normalized) throw new Error('Search query is required');
  const limit = Math.min(Math.max(options.limit || 10, 1), 100);
  const offset = Math.max(options.offset || 0, 0);
  const params = new URLSearchParams({ query: normalized, fields: PAPER_FIELDS, limit: String(limit), offset: String(offset) });
  if (options.yearFrom && options.yearTo) params.set('year', `${options.yearFrom}-${options.yearTo}`);
  else if (options.yearFrom) params.set('year', `${options.yearFrom}-`);
  else if (options.yearTo) params.set('year', `-${options.yearTo}`);
  if (options.openAccess !== undefined) params.set('openAccessPdf', String(options.openAccess));
  const data = await fetchJson(`${BASE_URL}/paper/search?${params}`);
  return { total: data.total || 0, papers: (data.data || []).map(mapPaper) };
}

export async function getPaper(paperId: string): Promise<Paper> {
  const data = await fetchJson(`${BASE_URL}/paper/${encodeURIComponent(paperId)}?fields=${PAPER_FIELDS}`);
  return mapPaper(data);
}

export async function getRecommendations(paperId: string, limit = 10): Promise<Paper[]> {
  const data = await fetchJson(`${BASE_URL}/paper/${encodeURIComponent(paperId)}/recommendations?fields=${PAPER_FIELDS}&limit=${Math.min(limit, 100)}`);
  return (data.recommendedPapers || []).map(mapPaper);
}

export async function getPaperCitations(paperId: string, limit = 10) {
  const data = await fetchJson(`${BASE_URL}/paper/${encodeURIComponent(paperId)}/citations?fields=${PAPER_FIELDS}&limit=${Math.min(limit, 100)}`);
  return data.citations || [];
}

export async function getPaperReferences(paperId: string, limit = 10) {
  const data = await fetchJson(`${BASE_URL}/paper/${encodeURIComponent(paperId)}/references?fields=${PAPER_FIELDS}&limit=${Math.min(limit, 100)}`);
  return data.references || [];
}

export async function getAuthor(authorId: string) {
  return fetchJson(`${BASE_URL}/author/${encodeURIComponent(authorId)}?fields=name,aliases,homepage,affiliations,paperCount,citationCount,hIndex`);
}

export async function searchAuthors(query: string, limit = 10) {
  const data = await fetchJson(`${BASE_URL}/author/search?query=${encodeURIComponent(query)}&fields=name,aliases,homepage,affiliations,paperCount,citationCount&limit=${Math.min(limit, 100)}`);
  return data.data || [];
}

export async function getAuthorPapers(authorId: string, limit = 50) {
  const data = await fetchJson(`${BASE_URL}/author/${encodeURIComponent(authorId)}/papers?fields=${PAPER_FIELDS}&limit=${Math.min(limit, 100)}`);
  return data.data || [];
}
