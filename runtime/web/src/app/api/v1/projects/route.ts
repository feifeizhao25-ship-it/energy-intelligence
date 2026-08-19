import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi, createApiResponse } from '@/lib/api/open-api-middleware';

/**
 * 开放 API v1 - 项目列表
 * 
 * GET /api/v1/projects
 * 
 * Headers:
 *   X-API-Key: your_api_key
 *   
 * Query Parameters:
 *   - page: 页码 (默认 1)
 *   - limit: 每页数量 (默认 20, 最大 100)
 *   - type: 项目类型过滤 (solar, wind, storage)
 *   - status: 状态过滤 (running, planning, warning)
 */

// Demo projects data
const projectsData = [
    {
        id: 'demo-1',
        name: '北京朝阳分布式光伏示范站',
        type: 'solar',
        capacity: 120,
        capacityUnit: 'kW',
        location: { address: '北京市朝阳区', lat: 39.9219, lng: 116.4434 },
        status: 'running',
        createdAt: '2024-12-15T00:00:00Z',
        metrics: { dailyGeneration: 450, monthlyGeneration: 12500, efficiency: 98.2 }
    },
    {
        id: 'demo-2',
        name: '内蒙古辉腾锡勒风电场 III 期',
        type: 'wind',
        capacity: 50000,
        capacityUnit: 'kW',
        location: { address: '内蒙古呼和浩特', lat: 41.0, lng: 111.0 },
        status: 'running',
        createdAt: '2024-12-20T00:00:00Z',
        metrics: { dailyGeneration: 120000, monthlyGeneration: 4500000, efficiency: 92.5 }
    },
    {
        id: 'demo-3',
        name: '上海临港工商业储能调峰站',
        type: 'storage',
        capacity: 2000,
        capacityUnit: 'kW',
        location: { address: '上海市浦东新区', lat: 30.9, lng: 121.9 },
        status: 'planning',
        createdAt: '2024-12-25T00:00:00Z',
        metrics: { dailyGeneration: 0, monthlyGeneration: 0, efficiency: 0 }
    },
    {
        id: 'demo-4',
        name: '广东惠州渔光互补项目',
        type: 'solar',
        capacity: 5000,
        capacityUnit: 'kW',
        location: { address: '广东省惠州市', lat: 23.1, lng: 114.4 },
        status: 'warning',
        createdAt: '2024-11-10T00:00:00Z',
        metrics: { dailyGeneration: 18000, monthlyGeneration: 650000, efficiency: 72.5 }
    }
];

async function handleGetProjects(req: NextRequest) {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');

    // 筛选
    let filtered = [...projectsData];
    if (type) filtered = filtered.filter(p => p.type === type);
    if (status) filtered = filtered.filter(p => p.status === status);

    // 分页
    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
        success: true,
        data: paginated,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total
        },
        meta: {
            timestamp: new Date().toISOString(),
            version: 'v1'
        }
    });
}

// 使用中间件包装处理程序
export const GET = withOpenApi(handleGetProjects, 'read:projects');
