import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for stations (demo mode)
const stationsDb: Map<string, any[]> = new Map();

// Demo stations for preset projects
stationsDb.set('demo-1', [
    {
        id: 'station-1-1',
        name: '1号逆变器组',
        type: 'inverter',
        status: 'online',
        power: 24.5, // kW
        efficiency: 98.2,
        temperature: 45,
        lastUpdate: new Date()
    },
    {
        id: 'station-1-2',
        name: '2号逆变器组',
        type: 'inverter',
        status: 'online',
        power: 23.8,
        efficiency: 97.8,
        temperature: 47,
        lastUpdate: new Date()
    },
    {
        id: 'station-1-3',
        name: '3号逆变器组',
        type: 'inverter',
        status: 'warning',
        power: 18.2,
        efficiency: 85.1,
        temperature: 62,
        lastUpdate: new Date(),
        alert: '温度过高，效率下降'
    }
]);

stationsDb.set('demo-2', [
    {
        id: 'station-2-1',
        name: '1号风机',
        type: 'turbine',
        status: 'online',
        power: 2500,
        windSpeed: 8.5,
        rpm: 12,
        lastUpdate: new Date()
    },
    {
        id: 'station-2-2',
        name: '2号风机',
        type: 'turbine',
        status: 'online',
        power: 2800,
        windSpeed: 9.2,
        rpm: 14,
        lastUpdate: new Date()
    },
    {
        id: 'station-2-3',
        name: '3号风机',
        type: 'turbine',
        status: 'maintenance',
        power: 0,
        windSpeed: 8.0,
        rpm: 0,
        lastUpdate: new Date(),
        alert: '计划维护中'
    }
]);

// GET - 获取项目下的所有站点/设备
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;

    const stations = stationsDb.get(projectId) || [];

    // 计算汇总数据
    const summary = {
        total: stations.length,
        online: stations.filter(s => s.status === 'online').length,
        warning: stations.filter(s => s.status === 'warning').length,
        offline: stations.filter(s => s.status === 'offline' || s.status === 'maintenance').length,
        totalPower: stations.reduce((sum, s) => sum + (s.power || 0), 0),
        avgEfficiency: stations.length > 0
            ? stations.reduce((sum, s) => sum + (s.efficiency || 0), 0) / stations.length
            : 0
    };

    return NextResponse.json({
        success: true,
        data: {
            stations,
            summary
        }
    });
}

// POST - 添加新站点/设备
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    const body = await req.json();

    const { name, type } = body;

    if (!name || !type) {
        return NextResponse.json({ error: 'Missing name or type' }, { status: 400 });
    }

    const newStation = {
        id: `station-${Date.now()}`,
        name,
        type,
        status: 'online',
        power: Math.random() * 100,
        efficiency: 95 + Math.random() * 5,
        temperature: 35 + Math.random() * 20,
        lastUpdate: new Date()
    };

    const existing = stationsDb.get(projectId) || [];
    existing.push(newStation);
    stationsDb.set(projectId, existing);

    return NextResponse.json({
        success: true,
        data: newStation
    });
}
