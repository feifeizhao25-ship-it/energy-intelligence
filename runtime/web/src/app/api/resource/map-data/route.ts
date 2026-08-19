import { NextRequest, NextResponse } from 'next/server';
import { CHINA_RESOURCE_GRID_DATA } from '@/data/resource-grid';

// 生成覆盖全中国的密集网格点（通过插值）
function generateDenseGrid(baseData: Array<{ lat: number, lng: number, ghi?: number, windSpeed?: number }>, type: 'solar' | 'wind') {
    const grid = [];

    // 中国范围：73°E - 135°E, 18°N - 54°N
    const lonStep = 1.5; // 更密集的网格
    const latStep = 1.2;

    for (let lat = 18; lat <= 54; lat += latStep) {
        for (let lng = 73; lng <= 135; lng += lonStep) {
            if (isRoughlyInChina(lat, lng)) {
                // 使用反距离加权插值计算该点的资源值
                const value = interpolateValue(lat, lng, baseData, type);
                if (value > 0) {
                    grid.push({
                        lat: Math.round(lat * 100) / 100,
                        lng: Math.round(lng * 100) / 100,
                        [type === 'solar' ? 'ghi' : 'windSpeed']: value
                    });
                }
            }
        }
    }

    return grid;
}

// 反距离加权插值
function interpolateValue(
    lat: number,
    lng: number,
    baseData: Array<{ lat: number, lng: number, ghi?: number, windSpeed?: number }>,
    type: 'solar' | 'wind'
): number {
    let weightedSum = 0;
    let weightSum = 0;
    const power = 2; // IDW 幂次

    // 找到最近的几个点进行插值
    for (const point of baseData) {
        const distance = Math.sqrt(
            Math.pow(lat - point.lat, 2) + Math.pow(lng - point.lng, 2)
        );

        if (distance < 0.01) {
            // 非常接近已知点，直接返回
            return type === 'solar' ? (point.ghi || 0) : (point.windSpeed || 0);
        }

        const weight = 1 / Math.pow(distance, power);
        const value = type === 'solar' ? (point.ghi || 0) : (point.windSpeed || 0);

        weightedSum += weight * value;
        weightSum += weight;
    }

    return weightSum > 0 ? Math.round(weightedSum / weightSum) : 0;
}

// 粗略判断点是否在中国境内
function isRoughlyInChina(lat: number, lng: number): boolean {
    // 东北角（俄罗斯）
    if (lat > 50 && lng < 85) return false;

    // 西北角（中亚）
    if (lat > 48 && lng < 80) return false;

    // 西南角（印度/巴基斯坦）
    if (lat < 28 && lng < 85) return false;

    // 南海过远区域
    if (lat < 20 && lng > 115) return false;

    // 东部海域
    if (lng > 125 && lat < 40) return false;

    return true;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'solar';

    try {
        // 使用预计算数据生成密集网格
        const baseData = type === 'solar' ? CHINA_RESOURCE_GRID_DATA.solar : CHINA_RESOURCE_GRID_DATA.wind;
        const gridData = generateDenseGrid(baseData, type as 'solar' | 'wind');

        // 转换为地图所需格式
        const data = gridData.map(point => {
            const resourceValue = type === 'solar' ? point.ghi : point.windSpeed;
            const maxValue = type === 'solar' ? 2100 : 10;

            return {
                lng: point.lng,
                lat: point.lat,
                count: resourceValue || 0,
                weight: ((resourceValue || 0) / maxValue) * 100,
                ghi: point.ghi,
                windSpeed: point.windSpeed
            };
        });

        console.log(`Generated ${data.length} grid points for ${type} resource map`);

        return NextResponse.json({
            success: true,
            data,
            type,
            max: 100,
            source: 'NASA POWER API (Pre-computed + Interpolated)',
            dataPoints: data.length,
            gridResolution: '~1.5° x 1.2°'
        });
    } catch (error) {
        console.error('Error generating map data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to generate resource data' },
            { status: 500 }
        );
    }
}
