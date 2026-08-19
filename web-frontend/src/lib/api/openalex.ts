import { Paper } from '@/types';

const BASE_URL = 'https://api.openalex.org';

export async function searchOpenAlex(query: string, limit: number = 10): Promise<Paper[]> {
    try {
        const url = `${BASE_URL}/works?search=${encodeURIComponent(query)}&per-page=${limit}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'mailto:test@example.com' // Replace with proper email
            }
        });

        if (!response.ok) {
            throw new Error(`OpenAlex API failed: ${response.status}`);
        }

        const data = await response.json();

        return data.results.map((work: any) => ({
            id: work.id.replace('https://openalex.org/', ''),
            title: work.title,
            authors: work.authorships.map((a: any) => a.author.display_name),
            year: work.publication_year,
            abstract: '', // OpenAlex abstract is inverted index, complicated to reconstruct usually
            citationCount: work.cited_by_count,
            pdfUrl: work.open_access.is_oa ? work.open_access.pdf_url : null,
            venue: work.primary_location?.source?.display_name || '',
            doi: work.doi ? work.doi.replace('https://doi.org/', '') : undefined
        }));

    } catch (error) {
        console.error('OpenAlex search failed', error);
        return [];
    }
}
