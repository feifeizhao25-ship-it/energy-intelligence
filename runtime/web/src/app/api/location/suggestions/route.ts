// API: 地址自动补全建议
import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getLocationSuggestions } from '@/lib/api/amap';

/**
 * 获取地址输入建议
 */
export async function GET(req: NextRequest) {
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
            { success: false, error: error.message || '获取建议失败' },
            { status: 500 }
        );
    }
}
