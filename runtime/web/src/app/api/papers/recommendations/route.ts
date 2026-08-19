import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/api/semantic-scholar';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    try {
        const data = await getRecommendations(id);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
    }
}
