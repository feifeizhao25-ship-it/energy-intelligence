import { NextRequest, NextResponse } from 'next/server';
import { compareSiteEnergies } from '@/lib/calculator/site-compare';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { lat, lng, province, address } = body;

        // 验证必要参数
        if (!lat || !lng || !province) {
            return NextResponse.json(
                { error: '缺少必要参数 (lat, lng, province)' },
                { status: 400 }
            );
        }

        // 执行聚合对比计算
        const result = await compareSiteEnergies({
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            province,
            address
        });

        return NextResponse.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('多能种对比API错误:', error);
        return NextResponse.json(
            { error: '对比计算失败，请稍后重试' },
            { status: 500 }
        );
    }
}
