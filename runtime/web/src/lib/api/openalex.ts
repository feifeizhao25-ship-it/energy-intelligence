import { Paper } from '@/types';

const BASE_URL = 'https://api.openalex.org';

export async function searchOpenAlex(query: string, limit: number = 10): Promise<Paper[]> {
    try {
        const contact = process.env.OPENALEX_CONTACT_EMAIL;
        const apiKey = process.env.OPENALEX_API_KEY;
        const url = `${BASE_URL}/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': `EnergyIntelligence/1.0 (${contact || 'development'})`,
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
            },
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            throw new Error(`OpenAlex API failed: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.results)) throw new Error('Invalid OpenAlex response');

        return data.results.map((work: any) => ({
            id: work.id.replace('https://openalex.org/', ''),
            title: work.title,
            authors: (work.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
            year: work.publication_year,
            abstract: '', // OpenAlex abstract is inverted index, complicated to reconstruct usually
            citationCount: work.cited_by_count,
            pdfUrl: work.best_oa_location?.is_oa ? work.best_oa_location.pdf_url || undefined : undefined,
            venue: work.primary_location?.source?.display_name || '',
            doi: work.doi ? work.doi.replace('https://doi.org/', '') : undefined,
            sourceProvider: 'OpenAlex',
            sourceUrl: work.id,
            retrievedAt: new Date().toISOString(),
            evidenceStatus: 'provider_verified' as const,
        }));

    } catch (error) {
        console.error('OpenAlex search failed', error);
        throw new Error('OpenAlex 数据暂时不可用，未返回模拟论文');
    }
}
