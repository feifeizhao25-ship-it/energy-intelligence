import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

/**
 * 开放 API v1 - 监控数据
 * 
 * GET /api/v1/projects/[id]/monitoring
 * 
 * Headers:
 *   X-API-Key: your_api_key
 *   
 * Query Parameters:
 *   - range: 时间范围 (realtime, 1h, 24h, 7d, 30d)
 *   - interval: 数据间隔 (1m, 5m, 15m, 1h, 1d)
 */

function generateTimeSeriesData(range: string, interval: string) {
    const now = Date.now();
    const data: any[] = [];

    let points = 24;
    let intervalMs = 60 * 60 * 1000; // 1 hour

    switch (range) {
        case 'realtime':
            points = 60;
            intervalMs = 60 * 1000;
            break;
        case '1h':
            points = 60;
            intervalMs = 60 * 1000;
            break;
        case '24h':
            points = interval === '1h' ? 24 : 288;
            intervalMs = interval === '1h' ? 60 * 60 * 1000 : 5 * 60 * 1000;
            break;
        case '7d':
            points = interval === '1d' ? 7 : 168;
            intervalMs = interval === '1d' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
            break;
        case '30d':
            points = interval === '1d' ? 30 : 720;
            intervalMs = interval === '1d' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
            break;
    }

    for (let i = points - 1; i >= 0; i--) {
        const timestamp = new Date(now - i * intervalMs);
        const hour = timestamp.getHours();

        // Solar curve simulation
        let powerMultiplier = 0;
        if (hour >= 6 && hour <= 18) {
            powerMultiplier = Math.sin((hour - 6) * Math.PI / 12);
        }

        data.push({
            timestamp: timestamp.toISOString(),
            power: Math.max(0, 80 * powerMultiplier * (0.9 + Math.random() * 0.2)),
            efficiency: 90 + Math.random() * 10,
            temperature: 35 + Math.random() * 25,
            irradiance: hour >= 6 && hour <= 18 ? 200 + 800 * powerMultiplier : 0,
            voltage: 380 + Math.random() * 20,
            current: powerMultiplier > 0 ? 150 * powerMultiplier + Math.random() * 20 : 0
        });
    }

    return data;
}

async function handleGetMonitoring(req: NextRequest, keyData: any) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[pathParts.length - 2];
    const range = url.searchParams.get('range') || '24h';
    const interval = url.searchParams.get('interval') || '1h';

    const timeSeries = generateTimeSeriesData(range, interval);

    // Calculate statistics
    const powers = timeSeries.map(d => d.power);
    const efficiencies = timeSeries.map(d => d.efficiency);

    const statistics = {
        power: {
            current: powers[powers.length - 1],
            max: Math.max(...powers),
            min: Math.min(...powers.filter(p => p > 0)),
            avg: powers.reduce((a, b) => a + b, 0) / powers.length
        },
        efficiency: {
            current: efficiencies[efficiencies.length - 1],
            max: Math.max(...efficiencies),
            min: Math.min(...efficiencies),
            avg: efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length
        },
        generation: {
            total: powers.reduce((a, b) => a + b, 0) // kWh approximation
        }
    };

    return NextResponse.json({
        success: true,
        data: {
            projectId,
            range,
            interval,
            dataPoints: timeSeries.length,
            timeSeries,
            statistics
        },
        meta: {
            timestamp: new Date().toISOString(),
            version: 'v1'
        }
    });
}

export const GET = withOpenApi(handleGetMonitoring, 'read:monitoring');
