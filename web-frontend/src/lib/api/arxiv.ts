// arXiv API 封装 (预印本下载)
import { Paper } from '@/types';

// 简单的内存缓存
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 缓存装饰器
function withCache<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    const key = `${fn.name}:${JSON.stringify(args)}`;
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const result = await fn(...args);
    cache.set(key, { data: result, expires: Date.now() + CACHE_DURATION });
    return result;
  }) as T;
}

const BASE_URL = 'http://export.arxiv.org/api/query';

/**
 * 搜索arXiv论文
 */
export const searchArxiv = withCache(async (
  query: string,
  options: { limit?: number } = {}
): Promise<Paper[]> => {
  try {
    const limit = options.limit || 10;

    // 构建查询参数
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: '0',
      max_results: limit.toString(),
      sortBy: 'submittedDate',
      sortOrder: 'descending'
    });

    const url = `${BASE_URL}?${params.toString()}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`arXiv API请求失败: ${response.status}`);
    }

    const xmlText = await response.text();

    // 解析XML响应
    const papers = parseArxivXML(xmlText);

    return papers;

  } catch (error) {
    console.error('搜索arXiv论文失败:', error);
    throw new Error('搜索论文失败，请稍后重试');
  }
});

/**
 * 解析arXiv XML响应
 */
function parseArxivXML(xmlText: string): Paper[] {
  const papers: Paper[] = [];

  try {
    // 使用正则表达式解析XML（简化版）
    const entryRegex = new RegExp('<entry>(.*?)</entry>', 'gs');
    const entries = xmlText.match(entryRegex) || [];

    for (const entry of entries) {
      try {
        // 提取基本信息
        const idMatch = entry.match(/<id>(.*?)<\/id>/);
        const titleMatch = entry.match(new RegExp('<title>(.*?)</title>', 's'));
        const summaryMatch = entry.match(new RegExp('<summary>(.*?)</summary>', 's'));
        const publishedMatch = entry.match(/<published>(.*?)<\/published>/);

        // 提取作者
        const authorMatches = entry.matchAll(/<name>(.*?)<\/name>/g);
        const authors = Array.from(authorMatches, m => m[1].trim());

        // 提取DOI（如果存在）
        const doiMatch = entry.match(/<arxiv:doi>(.*?)<\/arxiv:doi>/);

        // 提取PDF链接
        const pdfMatch = entry.match(/<link.*?href="(.*?\.pdf)".*?\/>/);

        // 提取分类
        const categoryMatches = entry.matchAll(/<category.*?term="(.*?)".*?\/>/g);
        const categories = Array.from(categoryMatches, m => m[1]);

        if (idMatch && titleMatch) {
          const paperId = extractArxivId(idMatch[1]);
          const year = publishedMatch ? new Date(publishedMatch[1]).getFullYear() : new Date().getFullYear();

          papers.push({
            id: paperId,
            title: titleMatch[1].trim().replace(/\n/g, ' '),
            authors,
            year,
            abstract: summaryMatch ? summaryMatch[1].trim().replace(/\n/g, ' ') : '',
            citationCount: 0, // arXiv不提供引用数
            pdfUrl: pdfMatch ? pdfMatch[1] : undefined,
            tldr: undefined,
            venue: `arXiv:${categories[0] || 'general'}`,
            doi: doiMatch ? doiMatch[1] : undefined
          });
        }
      } catch (parseError) {
        console.warn('解析arXiv条目失败:', parseError);
        continue;
      }
    }
  } catch (error) {
    console.error('XML解析失败:', error);
  }

  return papers;
}

/**
 * 从arXiv URL中提取论文ID
 */
function extractArxivId(url: string): string {
  const match = url.match(/arxiv\.org\/(?:abs|pdf)\/([\d.]+)(?:\.pdf)?/);
  return match ? match[1] : url;
}

/**
 * 根据分类搜索论文
 */
export const searchByCategory = withCache(async (
  category: string,
  limit: number = 10
): Promise<Paper[]> => {
  try {
    const params = new URLSearchParams({
      search_query: `cat:${category}`,
      start: '0',
      max_results: limit.toString(),
      sortBy: 'submittedDate',
      sortOrder: 'descending'
    });

    const url = `${BASE_URL}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`arXiv分类搜索失败: ${response.status}`);
    }

    const xmlText = await response.text();
    return parseArxivXML(xmlText);

  } catch (error) {
    console.error('按分类搜索失败:', error);
    throw new Error('按分类搜索失败，请稍后重试');
  }
});

/**
 * 获取最新论文
 */
export const getLatestPapers = withCache(async (limit: number = 10): Promise<Paper[]> => {
  try {
    // 搜索最新的物理学论文（最活跃的分类）
    return await searchByCategory('physics.flu-dyn', limit);
  } catch (error) {
    console.error('获取最新论文失败:', error);
    throw new Error('获取最新论文失败，请稍后重试');
  }
});

/**
 * 搜索特定主题的论文
 */
export const searchTopicPapers = withCache(async (
  topic: string,
  limit: number = 10
): Promise<Paper[]> => {
  try {
    // 新能源相关主题映射
    const topicQueries: Record<string, string> = {
      '光伏': 'solar cell OR photovoltaic',
      '风电': 'wind energy OR wind turbine',
      '电池': 'battery OR energy storage',
      '储能': 'energy storage OR battery',
      '氢能': 'hydrogen OR fuel cell',
      '碳中和': 'carbon neutral OR net zero',
      '智能电网': 'smart grid OR power grid',
      '电动汽车': 'electric vehicle OR EV'
    };

    const query = topicQueries[topic] || topic;
    return await searchArxiv(query, { limit });

  } catch (error) {
    console.error('主题搜索失败:', error);
    throw new Error('主题搜索失败，请稍后重试');
  }
});

/**
 * 获取arXiv统计信息
 */
export const getArxivStats = withCache(async () => {
  try {
    // 获取一些基本统计信息（模拟）
    const stats = {
      totalPapers: 2400000, // 估计总数
      monthlySubmissions: 120000, // 月度提交量
      categories: {
        'physics': 800000,
        'mathematics': 600000,
        'computer-science': 400000,
        'biology': 200000,
        'finance': 100000,
        'statistics': 100000
      },
      updatedAt: new Date().toISOString()
    };

    return stats;

  } catch (error) {
    console.error('获取arXiv统计信息失败:', error);
    throw new Error('获取统计信息失败，请稍后重试');
  }
});

/**
 * 获取arXiv论文PDF内容（直接链接）
 */
export const getPaperPDFUrl = (paperId: string): string => {
  return `https://arxiv.org/pdf/${paperId}.pdf`;
};

/**
 * 获取arXiv论文网页链接
 */
export const getPaperWebUrl = (paperId: string): string => {
  return `https://arxiv.org/abs/${paperId}`;
};

/**
 * 搜索相关的arXiv论文（基于其他API的结果）
 */
export const findRelatedArxiv = withCache(async (
  title: string,
  limit: number = 5
): Promise<Paper[]> => {
  try {
    // 提取关键词进行搜索
    const keywords = extractKeywords(title);
    if (keywords.length === 0) {
      return [];
    }

    const query = keywords.join(' OR ');
    return await searchArxiv(query, { limit });

  } catch (error) {
    console.error('搜索相关arXiv论文失败:', error);
    return [];
  }
});

/**
 * 从标题中提取搜索关键词
 */
function extractKeywords(title: string): string[] {
  // 移除常见停用词
  const stopWords = new Set(['the', 'of', 'and', 'in', 'to', 'a', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);

  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 5); // 最多5个关键词

  return words;
}
