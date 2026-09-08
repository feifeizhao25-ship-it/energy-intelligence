import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

// 数据连接、持久化状态与调度任务接通前，不返回虚假的激活/暂停成功。
async function unavailable(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const respond = (status: number, error: string, message: string) => NextResponse.json(
        { success: false, error, message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return respond(401, 'UNAUTHORIZED', '请先登录');
        const { id } = await props.params;
        const project = await prisma.project.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
        if (!project) return respond(404, 'PROJECT_NOT_FOUND', '项目不存在');
        return respond(503, 'MONITORING_UNAVAILABLE', '自动监测服务尚未开通，暂时无法激活、查询或暂停监测');
    } catch {
        return respond(503, 'SERVICE_UNAVAILABLE', '服务暂不可用，请稍后重试');
    }
}

export const POST = unavailable;
export const GET = unavailable;
export const PUT = unavailable;
