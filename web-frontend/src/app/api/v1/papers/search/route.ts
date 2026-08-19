import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

/**
 * 开放 API v1 - 文献搜索
 * 
 * GET /api/v1/papers/search
 * 
 * Headers:
 *   X-API-Key: your_api_key
 *   
 * Query Parameters:
 *   - q: 搜索关键词 (必需)
 *   - page: 页码
 *   - limit: 每页数量
 *   - year: 年份过滤
 *   - sort: 排序方式 (relevance, citations, year)
 */

const mockPapers = [
    {
        id: 'paper-001',
        title: 'Machine Learning for Solar Energy Prediction: A Comprehensive Review',
        authors: ['Zhang Wei', 'Li Ming', 'Wang Fang'],
        year: 2023,
        journal: 'Renewable Energy Reviews',
        abstract: 'This paper provides a comprehensive review of machine learning techniques applied to solar energy prediction...',
        keywords: ['solar energy', 'machine learning', 'prediction', 'deep learning'],
        citations: 245,
        doi: '10.1016/j.rser.2023.001',
        url: 'https://example.com/paper/001'
    },
    {
        id: 'paper-002',
        title: 'Deep Learning in Renewable Energy Systems',
        authors: ['Chen Hao', 'Liu Jie'],
        year: 2022,
        journal: 'Energy and AI',
        abstract: 'An exploration of deep learning applications in renewable energy systems including solar, wind, and storage...',
        keywords: ['deep learning', 'renewable energy', 'neural networks'],
        citations: 189,
        doi: '10.1016/j.eneai.2022.005',
        url: 'https://example.com/paper/002'
    },
    {
        id: 'paper-003',
        title: 'Neural Networks for Wind Power Forecasting',
        authors: ['Wang Lei', 'Zhang Yi', 'Chen Ming'],
        year: 2023,
        journal: 'Wind Energy',
        abstract: 'This study presents advanced neural network architectures for accurate wind power forecasting...',
        keywords: ['wind power', 'forecasting', 'LSTM', 'neural networks'],
        citations: 156,
        doi: '10.1002/we.2023.003',
        url: 'https://example.com/paper/003'
    },
    {
        id: 'paper-004',
        title: 'AI Applications in Smart Grid Optimization',
        authors: ['Li Hua', 'Zhou Wei'],
        year: 2024,
        journal: 'Applied Energy',
        abstract: 'Artificial intelligence techniques for optimizing smart grid operations and energy distribution...',
        keywords: ['smart grid', 'optimization', 'AI', 'energy management'],
        citations: 98,
        doi: '10.1016/j.apenergy.2024.001',
        url: 'https://example.com/paper/004'
    },
    {
        id: 'paper-005',
        title: 'Energy Storage Systems: Current Status and Future Trends',
        authors: ['Zhao Ming', 'Wang Xin', 'Liu Chen'],
        year: 2023,
        journal: 'Journal of Energy Storage',
        abstract: 'A comprehensive analysis of current energy storage technologies and emerging trends...',
        keywords: ['energy storage', 'batteries', 'hydrogen', 'future trends'],
        citations: 312,
        doi: '10.1016/j.est.2023.007',
        url: 'https://example.com/paper/005'
    }
];

async function handleSearchPapers(req: NextRequest, keyData: any) {
    const url = new URL(req.url);
    const query = url.searchParams.get('q');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const year = url.searchParams.get('year');
    const sort = url.searchParams.get('sort') || 'relevance';

    if (!query) {
        return NextResponse.json({
            success: false,
            error: {
                code: 'MISSING_QUERY',
                message: 'Search query (q) is required'
            }
        }, { status: 400 });
    }

    // 搜索匹配
    let results = mockPapers.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.abstract.toLowerCase().includes(query.toLowerCase()) ||
        p.keywords.some(k => k.toLowerCase().includes(query.toLowerCase()))
    );

    // 年份过滤
    if (year) {
        results = results.filter(p => p.year.toString() === year);
    }

    // 排序
    switch (sort) {
        case 'citations':
            results.sort((a, b) => b.citations - a.citations);
            break;
        case 'year':
            results.sort((a, b) => b.year - a.year);
            break;
        default: // relevance - keep order
            break;
    }

    // 分页
    const total = results.length;
    const startIndex = (page - 1) * limit;
    const paginated = results.slice(startIndex, startIndex + limit);

    return NextResponse.json({
        success: true,
        data: paginated,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
        },
        query: {
            q: query,
            year,
            sort
        },
        meta: {
            timestamp: new Date().toISOString(),
            version: 'v1'
        }
    });
}

export const GET = withOpenApi(handleSearchPapers, 'read:papers');
