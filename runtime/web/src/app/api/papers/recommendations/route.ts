import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations } from '@/lib/api/semantic-scholar';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
    const limited = await enforceRateLimit(request, PUBLIC_RULES.papers);
    if (limited) return limited;

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    try {
        const data = await getRecommendations(id);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ error: '获取文献推荐失败，请稍后重试' }, { status: 500 });
    }
}
