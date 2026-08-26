import { Paper } from '@/types';
import { findOpenAccess } from '../api/unpaywall';
import { getPaperPDFUrl } from '../api/arxiv';

export interface PdfStatus {
    url: string | null;
    source: 'direct' | 'unpaywall' | 'arxiv' | 'none';
    isOa: boolean;
    oaStatus: string; // gold, green, bronze, etc.
}

/**
 * 查找最佳 PDF 下载链接
 */
export async function findBestPdf(paper: Paper): Promise<PdfStatus> {
    // 1. 优先使用 Semantic Scholar 提供的 OA 链接
    if (paper.pdfUrl) {
        return {
            url: paper.pdfUrl,
            source: 'direct',
            isOa: true,
            oaStatus: 'gold' // Assume gold/unknown if direct link provided by Semantic Scholar
        };
    }

    // 2. 如果有 DOI，查询 Unpaywall
    if (paper.doi) {
        const oaResult = await findOpenAccess(paper.doi);
        if (oaResult && oaResult.best_oa_location) {
            return {
                url: oaResult.best_oa_location.url_for_pdf || oaResult.best_oa_location.url,
                source: 'unpaywall',
                isOa: oaResult.is_oa,
                oaStatus: oaResult.oa_status
            };
        }
    }

    // 3. 如果是 arXiv 论文
    if (paper.id && paper.venue && paper.venue.toLowerCase().includes('arxiv')) {
        // Semantic Scholar ID usually not Arxiv ID directly, but let's check input
        // Sometimes paper.id could be arxiv id if from arxiv source
        const arxivId = extractArxivId(paper);
        if (arxivId) {
            return {
                url: getPaperPDFUrl(arxivId),
                source: 'arxiv',
                isOa: true,
                oaStatus: 'green'
            };
        }
    }

    return {
        url: null,
        source: 'none',
        isOa: false,
        oaStatus: 'closed'
    };
}

function extractArxivId(paper: Paper): string | null {
    // 尝试从 URL 或 ID 中提取
    // ArXiv ID 格式通常是 2301.12345
    // Semantic Scholar 可能会在 externalIds 里给，但这里 User Type 定义还没加 externalIds
    // 简单粗暴尝试从 Link 匹配
    if (paper.pdfUrl && paper.pdfUrl.includes('arxiv.org')) {
        const match = paper.pdfUrl.match(/arxiv\.org\/pdf\/([\d.]+)/);
        if (match) return match[1];
    }
    return null;
}
