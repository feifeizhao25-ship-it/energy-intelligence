import { NextRequest, NextResponse } from 'next/server';
import { unifiedSearch } from '@/lib/papers/search';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, options } = body;

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const result = await unifiedSearch(query, options);

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Search API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Search failed' },
            { status: 500 }
        );
    }
}
