// Unpaywall API - 查找免费开放获取(OA)版本
import { Paper } from '@/types';

const BASE_URL = 'https://api.unpaywall.org/v2';
const EMAIL = 'your-email@example.com'; // Replace with a real email in prod, unpaywall requires it

export interface UnpaywallResult {
    doi: string;
    is_oa: boolean;
    oa_status: string; // gold, green, bronze, hybrid, closed
    best_oa_location: {
        url: string;
        url_for_pdf: string;
        version: string; // publishedVersion, submittedVersion
        license: string;
    } | null;
}

/**
 * 查找论文的OA状态和下载链接
 */
export async function findOpenAccess(doi: string): Promise<UnpaywallResult | null> {
    try {
        if (!doi) return null;

        const url = `${BASE_URL}/${doi}?email=${EMAIL}`;
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Unpaywall API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            doi: data.doi,
            is_oa: data.is_oa,
            oa_status: data.oa_status,
            best_oa_location: data.best_oa_location
        };

    } catch (error) {
        console.warn('Unpaywall lookup failed:', error);
        return null;
    }
}
