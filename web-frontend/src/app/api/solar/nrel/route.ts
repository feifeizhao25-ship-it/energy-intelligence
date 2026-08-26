
import { NextRequest, NextResponse } from 'next/server';
import { getPVWattsData, calculateSolarOutput } from '@/lib/api/nrel';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const capacity = parseFloat(searchParams.get('capacity') || '10'); // Default 10kW
    const tilt = parseFloat(searchParams.get('tilt') || '30');
    const azimuth = parseFloat(searchParams.get('azimuth') || '180');

    // For manual calculation fallback
    const electricityPrice = parseFloat(searchParams.get('price') || '0.5');
    const investment = parseFloat(searchParams.get('investment') || '0');

    if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json({ error: '无效的坐标参数' }, { status: 400 });
    }

    try {
        // Try getting official API data first
        if (process.env.NREL_API_KEY) {
            try {
                const data = await getPVWattsData(lat, lng, capacity, tilt, azimuth);
                return NextResponse.json({
                    success: true,
                    source: 'NREL API',
                    data
                });
            } catch (apiError) {
                console.warn('NREL API call failed, falling back to estimation:', apiError);
                // Fallthrough to estimation
            }
        }

        // Fallback to estimation
        const estimatedData = calculateSolarOutput(
            lat,
            lng,
            capacity,
            electricityPrice,
            investment > 0 ? investment : undefined
        );

        return NextResponse.json({
            success: true,
            source: 'Estimation (Manual)',
            note: '由于NREL API未配置或调用失败，返回估算数据',
            data: estimatedData
        });

    } catch (error) {
        console.error('Solar NREL API Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '光伏计算出错' },
            { status: 500 }
        );
    }
}
