// 资源数据API
import { NextRequest, NextResponse } from 'next/server';
import { getSolarResource, getWindResource } from '@/lib/api/nasa-power';
import {
    getCurrentWeather,
    getWeatherForecast,
    getAirQuality,
    getUVIndex
} from '@/lib/api/weather';
import { getAirQualityIndex } from '@/lib/api/open-meteo'; // Fallback or alternative

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const type = searchParams.get('type') || 'solar';

    if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
            { error: '无效的坐标参数' },
            { status: 400 }
        );
    }

    try {
        const startTime = Date.now();
        let data;

        switch (type) {
            case 'solar':
                data = await getSolarResource(lat, lng);
                break;
            case 'wind':
                data = await getWindResource(lat, lng);
                break;
            case 'weather':
                data = await getCurrentWeather(lat, lng);
                break;
            case 'forecast':
                data = await getWeatherForecast(lat, lng);
                break;
            case 'air_quality':
                try {
                    data = await getAirQuality(lat, lng);
                } catch (e) {
                    console.warn('OpenWeatherMap AQI failed, trying OpenMeteo', e);
                    data = await getAirQualityIndex(lat, lng);
                }
                break;
            case 'uv':
                data = await getUVIndex(lat, lng);
                break;
            case 'all':
                const [solar, wind, weather] = await Promise.all([
                    getSolarResource(lat, lng),
                    getWindResource(lat, lng),
                    getCurrentWeather(lat, lng)
                ]);
                data = { solar, wind, weather };
                break;
            default:
                return NextResponse.json(
                    { error: '无效的资源类型' },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            data,
            location: { lat, lng },
            type,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
        });
    } catch (error) {
        console.error('资源查询错误:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : '查询失败',
                location: { lat, lng }
            },
            { status: 500 }
        );
    }
}
