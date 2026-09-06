import { Paper, SearchOptions, SearchResult } from '@/types';
import { searchPapers as searchSemantic } from '../api/semantic-scholar';
import { searchArxiv } from '../api/arxiv';
import { searchOpenAlex } from '../api/openalex'; // Add Import
import { simpleChat } from '../ai/unified';

/**
 * 统一搜索入口：AI优化查询 + 多源搜索 + 结果合并
 */
/**
 * 统一搜索入口：AI优化查询 + 多源搜索 + 结果合并
 */
export async function unifiedSearch(
    originalQuery: string,
    options: SearchOptions = {}
): Promise<SearchResult> {

    // 1. AI 查询优化与翻译
    let queries = [originalQuery];

    // 检查是否包含中文
    const hasChinese = /[\u4e00-\u9fa5]/.test(originalQuery);

    // 如果包含中文，或者查询词较长，则启用 AI 优化/翻译
    if (hasChinese || (originalQuery.length > 10 && originalQuery.split(' ').length > 2)) {
        try {
            const optimized = await optimizeQuery(originalQuery);
            if (optimized.english && optimized.english.toLowerCase() !== originalQuery.toLowerCase()) {
                // 如果是中文搜索，优先将翻译后的英文排在前面供 API 使用
                if (hasChinese) {
                    queries = [optimized.english, originalQuery];
                } else {
                    queries.push(optimized.english);
                }
            }
        } catch (e) {
            console.warn('AI query optimization failed, using original query');
        }
    }

    // 2. 并行搜索多源
    const limit = options.limit || 10;

    // 使用优化后的第一个词（通常是翻译后的英文）进行搜索
    const finalQuery = queries[0];

    const searchPromises: Promise<{ total: number; papers: Paper[] }>[] = [
        searchSemantic(finalQuery, options),
        searchOpenAlex(finalQuery, limit).then(papers => ({ total: papers.length, papers }))
    ];

    // 如果包含中文且有原始中文词，对于某些可能支持中文的源可以尝试（虽然目前主流源都是英文为主）
    // 为了保证质量，这里我们主要信任英文搜索结果

    {
        searchPromises.push(searchArxiv(finalQuery, { limit }).then(papers => ({ total: papers.length, papers })));
    }

    const settled = await Promise.allSettled(searchPromises);
    const providerNames = ['Semantic Scholar', 'OpenAlex', 'arXiv'] as const;
    const providers = settled.map((result, index) => ({
        name: providerNames[index],
        status: result.status === 'fulfilled' ? 'available' as const : 'unavailable' as const,
    }));
    if (settled.every(result => result.status === 'rejected')) {
        throw new Error('全部学术数据源暂时不可用，未返回空结果或模拟论文');
    }
    const results = settled.map(result =>
        result.status === 'fulfilled' ? result.value : { total: 0, papers: [] as Paper[] }
    );

    // 3. 结果合并与去重
    const semanticResult = results[0];
    const openAlexResult = results[1];
    const arxivResult = results[2];

    const allPapers = [...(semanticResult.papers || [])];
    const existingTitles = new Set(allPapers.map((p: any) => normalizeTitle(p.title)));

    const mergeResults = (targetPapers: any[]) => {
        if (!targetPapers) return;
        for (const p of targetPapers) {
            const normTitle = normalizeTitle(p.title);
            if (!existingTitles.has(normTitle)) {
                allPapers.push(p);
                existingTitles.add(normTitle);
            }
        }
    };

    mergeResults(openAlexResult?.papers);
    mergeResults(arxivResult?.papers);

    return {
        total: results.reduce((sum, result) => sum + (result.total || 0), 0),
        papers: allPapers.slice(0, limit),
        providers,
    };
}

// 辅助函数：标准化标题
function normalizeTitle(title: string): string {
    return title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// AI 优化查询
async function optimizeQuery(query: string): Promise<{ english: string, chinese: string }> {
    const prompt = `
    你是一个专业的学术文献检索专家。请将以下用户的检索词转化为最适合在英语学术数据库（如 Semantic Scholar, arXiv, Nature）中检索的专业英语关键词。
    
    规则：
    1. 如果输入包含中文，请结合语境翻译成最精准、最常用的学术英语术语（如“光伏”翻译成“photovoltaic”而不是“light voltaic”）。
    2. 如果输入已经是英文，请优化为更标准、更专业的学术词汇（如将 "solar power stability" 优化为 "photovoltaic stability performance"）。
    3. 去掉口语化词汇，只保留核心关键词。
    4. 必须只返回 JSON 格式：{ "english": "...", "chinese": "..." }，不要包含任何解释。

    用户查询："${query}"
    `;

    try {
        const raw = await simpleChat(prompt, 'deepseek-v3'); // 使用更擅长逻辑的 v3
        const jsonStr = raw.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('OCR optimization parse error:', e);
        return { english: query, chinese: query };
    }
}
