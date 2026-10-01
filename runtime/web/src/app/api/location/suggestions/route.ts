// API: 地址自动补全建议
import { NextRequest, NextResponse } from 'next/server';
import { safeErrorMessage } from '@/lib/api/safe-error';
export const dynamic = 'force-dynamic';
import { getLocationSuggestions } from '@/lib/api/amap';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';

/**
 * 获取地址输入建议
 */
export async function GET(req: NextRequest) {
    const limited = await enforceRateLimit(req, PUBLIC_RULES.amap);
    if (limited) return limited;

    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('query');

        if (!query || query.length < 2) {
            return NextResponse.json({
                success: true,
                data: []
            });
        }

        const suggestions = await getLocationSuggestions(query);

        return NextResponse.json({
            success: true,
            data: suggestions
        });

    } catch (error: any) {
        console.error('Location suggestions error:', error);
        return NextResponse.json(
            { success: false, error: safeErrorMessage(error, '获取建议失败') },
            { status: 500 }
        );
    }
}
