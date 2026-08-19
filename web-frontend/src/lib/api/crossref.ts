// Crossref API - 获取引用格式和元数据

const BASE_URL = 'https://api.crossref.org/works';

/**
 * 获取论文引用格式
 */
export async function getCitation(doi: string, style: string = 'apa', lang: string = 'en-US'): Promise<string> {
    try {
        if (!doi) return '';

        // Crossref content negotiation
        const url = `${BASE_URL}/${doi}/transform/text/x-bibliography?style=${style}&locale=${lang}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'text/x-bibliography'
            }
        });

        if (!response.ok) {
            throw new Error(`Crossref API error: ${response.status}`);
        }

        return await response.text();

    } catch (error) {
        console.error('Get citation failed:', error);
        return '';
    }
}

/**
 * 批量导出引用 (BibTeX)
 */
export async function getBibtex(doi: string): Promise<string> {
    try {
        if (!doi) return '';

        const url = `${BASE_URL}/${doi}/transform/application/x-bibtex`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/x-bibtex'
            }
        });

        if (!response.ok) {
            throw new Error(`BibTeX fetch failed: ${response.status}`);
        }

        return await response.text();

    } catch (error) {
        console.error('Get BibTeX failed:', error);
        return '';
    }
}
