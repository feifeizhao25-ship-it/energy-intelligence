import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';

/**
 * 开放 API v1 - 项目详情
 * 
 * GET /api/v1/projects/[id]
 * 
 * Headers:
 *   X-API-Key: your_api_key
 */

const projectsData: Record<string, any> = {
    'demo-1': {
        id: 'demo-1',
        name: '北京朝阳分布式光伏示范站',
        description: '位于北京市朝阳区的分布式光伏示范项目，采用高效单晶硅组件',
        type: 'solar',
        capacity: 120,
        capacityUnit: 'kW',
        location: {
            address: '北京市朝阳区',
            lat: 39.9219,
            lng: 116.4434,
            timezone: 'Asia/Shanghai'
        },
        status: 'running',
        createdAt: '2024-12-15T00:00:00Z',
        updatedAt: new Date().toISOString(),
        equipment: {
            panels: { count: 400, type: '单晶硅', power: 300 },
            inverters: { count: 3, type: '组串式', power: 40 }
        },
        metrics: {
            realtime: {
                power: 85.3,
                efficiency: 98.2,
                temperature: 45.5
            },
            daily: {
                generation: 450,
                peakPower: 115,
                avgEfficiency: 97.8
            },
            monthly: {
                generation: 12500,
                peakPower: 118,
                avgEfficiency: 96.5
            },
            cumulative: {
                totalGeneration: 125000,
                operatingDays: 30,
                co2Saved: 102.5
            }
        },
        health: {
            score: 98,
            status: 'excellent',
            alerts: { active: 1, resolved: 5 }
        }
    },
    'demo-2': {
        id: 'demo-2',
        name: '内蒙古辉腾锡勒风电场 III 期',
        description: '大型风电场项目，配备最新一代大功率风机',
        type: 'wind',
        capacity: 50000,
        capacityUnit: 'kW',
        location: {
            address: '内蒙古呼和浩特',
            lat: 41.0,
            lng: 111.0,
            timezone: 'Asia/Shanghai'
        },
        status: 'running',
        createdAt: '2024-12-20T00:00:00Z',
        updatedAt: new Date().toISOString(),
        equipment: {
            turbines: { count: 20, type: '直驱永磁', power: 2500 }
        },
        metrics: {
            realtime: {
                power: 35000,
                windSpeed: 8.5,
                rpm: 12
            },
            daily: {
                generation: 120000,
                peakPower: 48000,
                avgWindSpeed: 7.8
            },
            monthly: {
                generation: 4500000,
                peakPower: 49500,
                avgWindSpeed: 8.2
            },
            cumulative: {
                totalGeneration: 45000000,
                operatingDays: 25,
                co2Saved: 36750
            }
        },
        health: {
            score: 85,
            status: 'good',
            alerts: { active: 2, resolved: 12 }
        }
    }
};

async function handleGetProject(req: NextRequest, keyData: any) {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[pathParts.length - 1];

    const project = projectsData[projectId];

    if (!project) {
        return NextResponse.json({
            success: false,
            error: {
                code: 'PROJECT_NOT_FOUND',
                message: `Project with id '${projectId}' not found`
            }
        }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        data: project,
        meta: {
            timestamp: new Date().toISOString(),
            version: 'v1'
        }
    });
}

export const GET = withOpenApi(handleGetProject, 'read:projects');
