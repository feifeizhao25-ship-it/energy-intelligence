import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';
import { searchPapers } from '@/lib/api/semantic-scholar';
import { safeErrorMessage } from '@/lib/api/safe-error';

async function handleSearchPapers(req: NextRequest, _keyData: unknown) {
    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.trim();
    if (!query) {
        return NextResponse.json({ success: false, error: { code: 'MISSING_QUERY', message: '请提供检索词（参数 q）' } }, { status: 400 });
    }
    const page = Math.max(Number.parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
    const year = url.searchParams.get('year');
    try {
        const result = await searchPapers(query, {
            limit,
            offset: (page - 1) * limit,
            yearFrom: year ? Number.parseInt(year, 10) : undefined,
            yearTo: year ? Number.parseInt(year, 10) : undefined,
        });
        return NextResponse.json({
            success: true,
            data: result.papers,
            pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit), hasMore: page * limit < result.total },
            meta: { source: 'Semantic Scholar', retrievedAt: new Date().toISOString() },
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: { code: 'UPSTREAM_UNAVAILABLE', message: safeErrorMessage(error, '文献检索服务暂时不可用，请稍后再试') },
        }, { status: 503 });
    }
}

export const GET = withOpenApi(handleSearchPapers, 'read:papers');
