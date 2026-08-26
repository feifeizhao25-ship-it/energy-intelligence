import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

// 内存中的示范项目 (与列表 API 同步)
const demoProjects: Record<string, any> = {
    'demo-1': {
        id: 'demo-1',
        userId: 'dev-master-id',
        name: '北京朝阳分布式光伏示范站',
        type: 'solar',
        capacity: 120,
        lat: 39.9219,
        lng: 116.4434,
        parameters: { address: '北京市朝阳区', status: 'running' },
        createdAt: new Date('2024-12-15'),
        updatedAt: new Date()
    },
    'demo-2': {
        id: 'demo-2',
        userId: 'dev-master-id',
        name: '内蒙古辉腾锡勒风电场 III 期',
        type: 'wind',
        capacity: 50000,
        lat: 41.0,
        lng: 111.0,
        parameters: { address: '内蒙古呼和浩特', status: 'running' },
        createdAt: new Date('2024-12-20'),
        updatedAt: new Date()
    },
    'demo-3': {
        id: 'demo-3',
        userId: 'dev-master-id',
        name: '上海临港工商业储能调峰站',
        type: 'storage',
        capacity: 2000,
        lat: 30.9,
        lng: 121.9,
        parameters: { address: '上海市浦东新区', status: 'planning' },
        createdAt: new Date('2024-12-25'),
        updatedAt: new Date()
    },
    'demo-4': {
        id: 'demo-4',
        userId: 'dev-master-id',
        name: '广东惠州渔光互补项目',
        type: 'solar',
        capacity: 5000,
        lat: 23.1,
        lng: 114.4,
        parameters: { address: '广东省惠州市', status: 'warning' },
        createdAt: new Date('2024-11-10'),
        updatedAt: new Date()
    }
};

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;

    // 检查是否是 demo 项目
    if (projectId.startsWith('demo-') || projectId.startsWith('local-')) {
        const demoProject = demoProjects[projectId];
        if (demoProject) {
            return NextResponse.json({ success: true, data: demoProject, _fallback: true });
        }
        // local- 开头的是动态创建的，返回通用模板
        return NextResponse.json({
            success: true,
            data: {
                id: projectId,
                name: '新创建的电站',
                type: 'solar',
                capacity: 500,
                parameters: { address: '未知位置', status: 'planning' },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            _fallback: true
        });
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: project });
    } catch (error) {
        console.error('Failed to fetch project:', error);
        // Fallback for DB errors
        return NextResponse.json({
            success: true,
            data: {
                id: projectId,
                name: '电站详情加载中...',
                type: 'solar',
                capacity: 100,
                parameters: { address: '数据库连接中', status: 'loading' },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            _fallback: true
        });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || 'dev-master-id';

    // 对于 demo 项目，直接返回成功（不实际删除）
    if (params.id.startsWith('demo-') || params.id.startsWith('local-')) {
        return NextResponse.json({ success: true, _demo: true });
    }

    try {
        await prisma.project.delete({
            where: {
                id: params.id,
                userId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete project:', error);
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }
}
