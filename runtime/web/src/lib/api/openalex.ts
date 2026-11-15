import { Paper } from '@/types';

export function parseOpenAlexWorks(data: { results?: any[] }): Paper[] {
    if (!Array.isArray(data.results)) throw new Error('OpenAlex 数据暂时不可用，未返回模拟论文');
    return data.results.map((work: any) => ({
        id: String(work.id || '').replace('https://openalex.org/', ''),
        title: work.title,
        authors: (work.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
        year: work.publication_year ?? null,
        abstract: '',
        citationCount: work.cited_by_count ?? null,
        pdfUrl: work.best_oa_location?.is_oa ? work.best_oa_location.pdf_url || undefined : undefined,
        venue: work.primary_location?.source?.display_name || '',
        doi: work.doi ? work.doi.replace('https://doi.org/', '') : undefined,
        sourceProvider: 'OpenAlex',
        sourceUrl: work.id,
        retrievedAt: new Date().toISOString(),
        evidenceStatus: 'provider_verified' as const,
    }));
}

export async function searchOpenAlex(_query: string, _limit: number = 10): Promise<Paper[]> {
    throw new Error('OVERSEAS_SOURCE_DISABLED');
}
