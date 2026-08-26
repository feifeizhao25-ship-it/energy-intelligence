import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOpenApi } from '@/lib/api/open-api-middleware';

async function handleGetProjects(req: NextRequest, keyData: { userId: string }) {
    const url = new URL(req.url);
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '20', 10)));
    const type = url.searchParams.get('type') || undefined;
    const where = { userId: keyData.userId, ...(type ? { type: type.toUpperCase() } : {}) };
    try {
        const [projects, total] = await prisma.$transaction([
            prisma.project.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
            prisma.project.count({ where }),
        ]);
        return NextResponse.json({ success: true, data: projects, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total }, meta: { timestamp: new Date().toISOString(), version: 'v1', evidenceStatus: 'database' } });
    } catch (error) {
        console.error('Open API project query failed', error);
        return NextResponse.json({ success: false, error: { code: 'PROJECT_STORAGE_UNAVAILABLE', message: '项目数据暂时无法读取，未返回示例数据' } }, { status: 503 });
    }
}

export const GET = withOpenApi(handleGetProjects, 'read:projects');
