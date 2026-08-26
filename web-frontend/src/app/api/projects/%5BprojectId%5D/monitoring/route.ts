import { NextRequest, NextResponse } from 'next/server';

// Generate mock monitoring data
function generateMonitoringData(projectId: string, range: string) {
    const now = new Date();
    const data: any[] = [];

    let points = 24; // default: 24 hours
    let interval = 60 * 60 * 1000; // 1 hour

    if (range === '7d') {
        points = 7 * 24;
        interval = 60 * 60 * 1000;
    } else if (range === '30d') {
        points = 30;
        interval = 24 * 60 * 60 * 1000;
    } else if (range === 'realtime') {
        points = 60;
        interval = 60 * 1000; // 1 minute
    }

    // Different base values for different projects
    const baseValues: Record<string, { power: number; efficiency: number; capacity: number }> = {
        'demo-1': { power: 80, efficiency: 96, capacity: 120 },
        'demo-2': { power: 35000, efficiency: 92, capacity: 50000 },
        'demo-3': { power: 0, efficiency: 0, capacity: 2000 },
        'demo-4': { power: 3500, efficiency: 88, capacity: 5000 }
    };

    const base = baseValues[projectId] || { power: 50, efficiency: 90, capacity: 100 };

    for (let i = points - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * interval);
        const hour = time.getHours();

        // Solar: production curve follows sun (peak at noon)
        let powerMultiplier = 1;
        if (projectId.includes('demo-1') || projectId.includes('demo-4')) {
            // Solar curve
            if (hour >= 6 && hour <= 18) {
                powerMultiplier = Math.sin((hour - 6) * Math.PI / 12);
            } else {
                powerMultiplier = 0;
            }
        } else if (projectId.includes('demo-2')) {
            // Wind: more random but with pattern
            powerMultiplier = 0.5 + 0.5 * Math.sin(i * 0.3) + Math.random() * 0.3;
        }

        const power = base.power * powerMultiplier * (0.9 + Math.random() * 0.2);
        const efficiency = base.efficiency * (0.95 + Math.random() * 0.1);
        const temperature = 35 + Math.random() * 25;
        const irradiance = hour >= 6 && hour <= 18 ? 200 + 800 * powerMultiplier : 0;

        data.push({
            time: time.toISOString(),
            power: Math.max(0, power).toFixed(1),
            efficiency: efficiency.toFixed(1),
            temperature: temperature.toFixed(1),
            irradiance: irradiance.toFixed(0),
            pr: (powerMultiplier * 85 + Math.random() * 10).toFixed(1) // Performance Ratio
        });
    }

    return data;
}

// GET - 获取监控数据
export async function GET(
    req: NextRequest,
    { params }: { params: { projectId: string } }
) {
    const projectId = params.projectId;
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '24h'; // 'realtime' | '24h' | '7d' | '30d'

    const monitoringData = generateMonitoringData(projectId, range);

    // Calculate summary statistics
    const powers = monitoringData.map(d => parseFloat(d.power));
    const efficiencies = monitoringData.map(d => parseFloat(d.efficiency)).filter(e => e > 0);

    const summary = {
        currentPower: parseFloat(monitoringData[monitoringData.length - 1]?.power || '0'),
        maxPower: Math.max(...powers),
        avgPower: powers.reduce((a, b) => a + b, 0) / powers.length,
        totalGeneration: powers.reduce((a, b) => a + b, 0) * (range === '24h' ? 1 : range === '7d' ? 1 : 24), // simplified
        avgEfficiency: efficiencies.length > 0 ? efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length : 0,
        avgTemperature: monitoringData.reduce((a, b) => a + parseFloat(b.temperature), 0) / monitoringData.length,
        dataPoints: monitoringData.length,
        lastUpdate: new Date().toISOString()
    };

    return NextResponse.json({
        success: true,
        data: {
            range,
            timeSeries: monitoringData,
            summary
        }
    });
}
