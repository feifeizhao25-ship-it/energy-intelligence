import { Paper } from '@/types';

const BASE_URL = 'https://api.core.ac.uk/v3';
const API_KEY = process.env.CORE_API_KEY || '';

export async function searchCore(query: string, limit: number = 10): Promise<Paper[]> {
    if (!API_KEY) {
        console.warn('CORE API Key missing');
        return [];
    }

    try {
        const response = await fetch(`${BASE_URL}/search/works`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: query,
                limit
            })
        });

        if (!response.ok) return [];

        const data = await response.json();

        return data.results.map((item: any) => ({
            id: `core-${item.id}`,
            title: item.title,
            authors: item.authors.map((a: any) => a.name),
            year: item.yearPublished,
            abstract: item.abstract,
            citationCount: 0, // CORE search might not return citations in this endpoint
            pdfUrl: item.downloadUrl,
            venue: item.publisher
        }));

    } catch (e) {
        return [];
    }
}
