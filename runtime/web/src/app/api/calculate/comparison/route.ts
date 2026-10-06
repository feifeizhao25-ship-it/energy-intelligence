import { NextRequest, NextResponse } from 'next/server';
import { compareSiteEnergies } from '@/lib/calculator/site-compare';
import { enforceRateLimit, PUBLIC_RULES } from '@/lib/security/rate-limit';
import { TariffUnavailableError } from '@/lib/pricing/tariffs';

export async function POST(request: NextRequest) {
    const limited = await enforceRateLimit(request, PUBLIC_RULES.calculators);
    if (limited) return limited;

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
        if (error instanceof TariffUnavailableError) {
            return NextResponse.json(
                { error: error.lookup.message, code: error.lookup.status === 'market' ? 'MARKET_TOU' : 'PRICE_UNAVAILABLE' },
                { status: 422 }
            );
        }
        console.error('多能种对比API错误:', error);
        return NextResponse.json(
            { error: '对比计算失败，请稍后重试' },
            { status: 500 }
        );
    }
}
