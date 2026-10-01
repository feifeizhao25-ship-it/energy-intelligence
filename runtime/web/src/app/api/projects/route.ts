import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { enforceStorageLimit } from '@/lib/membership/storage-limits';

async function currentUserId() {
    const session = await getServerSession(authOptions);
    return session?.user?.id;
}

export async function GET() {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    try {
        const projects = await prisma.project.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json({ success: true, data: projects });
    } catch (error) {
        console.error('Failed to load projects:', error);
        return NextResponse.json({ error: '项目服务暂时不可用，请稍后再试' }, { status: 503 });
    }
}

export async function POST(req: NextRequest) {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    try {
        const full = await enforceStorageLimit(userId, 'projects');
        if (full) return full;
        const { name, type, capacity, location, lat, lng } = await req.json();
        const numericCapacity = Number(capacity);
        if (!name || !type || !Number.isFinite(numericCapacity) || numericCapacity <= 0) {
            return NextResponse.json({ error: '项目名称、类型或装机容量填写不正确' }, { status: 400 });
        }
        const project = await prisma.project.create({
            data: {
                userId,
                name: String(name).trim(),
                type: String(type).toUpperCase(),
                capacity: numericCapacity,
                location: location ? String(location).trim() : null,
                lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
                lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
                parameters: { status: 'planning', gridConnection: 'pending' },
            },
        });
        return NextResponse.json({ success: true, data: project }, { status: 201 });
    } catch (error) {
        console.error('Failed to create project:', error);
        return NextResponse.json({ error: '创建项目失败，请稍后重试' }, { status: 500 });
    }
}
