import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

// In-memory fallback storage (for demo when DB is unavailable)
const inMemoryProjects: any[] = [
    {
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
    {
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
    }
];

// 获取项目列表
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || 'dev-master-id';

    try {
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, data: projects });
    } catch (error) {
        console.error('DB failed, using in-memory fallback:', error);
        // Fallback to in-memory
        return NextResponse.json({
            success: true,
            data: inMemoryProjects.filter(p => p.userId === userId),
            _fallback: true
        });
    }
}

// 创建新项目
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || 'dev-master-id';

    try {
        const body = await req.json();
        const { name, type, capacity, location, lat, lng } = body;

        if (!name || !type || !capacity) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        try {
            const project = await prisma.project.create({
                data: {
                    userId,
                    name,
                    type,
                    capacity: parseFloat(capacity),
                    lat: lat || 39.9,
                    lng: lng || 116.4,
                    parameters: {
                        address: location || 'Unknown Location',
                        status: 'planning',
                        gridConnection: 'pending'
                    }
                }
            });
            return NextResponse.json({ success: true, data: project });
        } catch (dbError) {
            console.error('DB create failed, using in-memory:', dbError);
            // Fallback: create in memory
            const newProject = {
                id: `local-${Date.now()}`,
                userId,
                name,
                type,
                capacity: parseFloat(capacity),
                lat: lat || 39.9,
                lng: lng || 116.4,
                parameters: {
                    address: location || 'Unknown Location',
                    status: 'planning',
                    gridConnection: 'pending'
                },
                createdAt: new Date(),
                updatedAt: new Date()
            };
            inMemoryProjects.push(newProject);
            return NextResponse.json({ success: true, data: newProject, _fallback: true });
        }
    } catch (error) {
        console.error('Failed to create project:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}
