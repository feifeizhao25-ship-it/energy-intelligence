import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withOpenApi } from '@/lib/api/open-api-middleware';

async function handleGetProject(req: NextRequest, keyData: { userId: string }) {
    const projectId = new URL(req.url).pathname.split('/').pop() || '';
    try {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId: keyData.userId } });
        if (!project) return NextResponse.json({ success: false, error: { code: 'PROJECT_NOT_FOUND', message: '项目不存在或无权访问' } }, { status: 404 });
        return NextResponse.json({ success: true, data: project, meta: { timestamp: new Date().toISOString(), version: 'v1', evidenceStatus: 'database' } });
    } catch (error) {
        console.error('Open API project detail query failed', error);
        return NextResponse.json({ success: false, error: { code: 'PROJECT_STORAGE_UNAVAILABLE', message: '项目数据暂时无法读取，未返回示例数据' } }, { status: 503 });
    }
}

export const GET = withOpenApi(handleGetProject, 'read:projects');
