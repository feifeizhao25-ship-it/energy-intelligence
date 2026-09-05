// 文献检索API
import { NextRequest, NextResponse } from 'next/server';
import { searchPapers, getPaper, getRecommendations } from '@/lib/api/semantic-scholar';
import { searchArxiv } from '@/lib/api/arxiv';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query')?.trim();
    const paperId = searchParams.get('id');
    const action = searchParams.get('action') || 'search';
    const source = searchParams.get('source') || 'semantic-scholar';
    const yearFrom = searchParams.get('yearFrom');
    const openAccess = searchParams.get('openAccess') === 'true';
    const limit = Number(searchParams.get('limit') ?? '10');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        (yearFrom !== null && (!/^\d{4}$/.test(yearFrom) || Number(yearFrom) < 1800 || Number(yearFrom) > new Date().getFullYear())) ||
        !['semantic-scholar', 'arxiv'].includes(source) || (query && query.length > 2000)) {
        return NextResponse.json({ error: '检索参数不正确：数量须为 1 至 100，年份须有效，来源须受支持' }, { status: 400 });
    }

    try {
        const startTime = Date.now();
        let data;

        switch (action) {
            case 'search':
                if (!query) {
                    return NextResponse.json(
                        { error: '请提供搜索关键词' },
                        { status: 400 }
                    );
                }
                if (source === 'arxiv') {
                    data = await searchArxiv(query, { limit });
                } else {
                    data = await searchPapers(query, {
                        yearFrom: yearFrom ? parseInt(yearFrom) : undefined,
                        openAccess,
                        limit
                    });
                }
                break;

            case 'detail':
                if (!paperId) {
                    return NextResponse.json(
                        { error: '请提供论文ID' },
                        { status: 400 }
                    );
                }
                data = await getPaper(paperId);
                break;

            case 'recommend':
                if (!paperId) {
                    return NextResponse.json(
                        { error: '请提供论文ID' },
                        { status: 400 }
                    );
                }
                data = await getRecommendations(paperId, limit);
                break;

            default:
                return NextResponse.json(
                    { error: '无效的操作类型' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            data,
            action,
            source,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });
    } catch {
        return NextResponse.json(
            { error: '文献数据源暂时不可用，请稍后重试', code: 'UPSTREAM_UNAVAILABLE' },
            { status: 503 }
        );
    }
}
