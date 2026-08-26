
import { NextRequest, NextResponse } from 'next/server';
import {
    geocodeAddress,
    reverseGeocode,
    searchNearbyPOIs,
    getLocationSuggestions
} from '@/lib/api/amap';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const address = searchParams.get('address');
    const query = searchParams.get('query');
    const keywords = searchParams.get('keywords')?.split(',');
    const radius = parseFloat(searchParams.get('radius') || '5000');

    try {
        let data;

        switch (action) {
            case 'geocode':
                if (!address) {
                    return NextResponse.json({ error: '请提供地址参数 address' }, { status: 400 });
                }
                data = await geocodeAddress(address);
                break;

            case 'reverse':
                if (isNaN(lat) || isNaN(lng)) {
                    return NextResponse.json({ error: '无效的坐标参数' }, { status: 400 });
                }
                data = await reverseGeocode(lat, lng);
                break;

            case 'poi':
                if (isNaN(lat) || isNaN(lng)) {
                    return NextResponse.json({ error: '无效的坐标参数' }, { status: 400 });
                }
                if (!keywords || keywords.length === 0) {
                    return NextResponse.json({ error: '请提供关键词 keywords' }, { status: 400 });
                }
                data = await searchNearbyPOIs(lat, lng, keywords, radius);
                break;

            case 'suggest':
                if (!query) {
                    return NextResponse.json({ error: '请提供查询词 query' }, { status: 400 });
                }
                data = await getLocationSuggestions(query);
                break;

            default:
                return NextResponse.json({ error: '无效的action参数 (geocode, reverse, poi, suggest)' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Location API Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '位置服务出错' },
            { status: 500 }
        );
    }
}
