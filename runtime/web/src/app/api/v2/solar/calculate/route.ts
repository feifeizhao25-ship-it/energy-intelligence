import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

const respond = (status: number, body: object) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store' },
});

// V2 原实现使用固定辐照值冒充 NASA 来源，尚未通过计算与证据核验。
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return respond(401, { success: false, message: '请先登录' });
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return respond(400, { success: false, message: '请求参数无效' });
        }
        if (body.projectId !== undefined && body.projectId !== null) {
            if (typeof body.projectId !== 'string' || !body.projectId.trim()) {
                return respond(400, { success: false, message: '项目编号无效' });
            }
            const project = await prisma.project.findFirst({
                where: { id: body.projectId, userId: session.user.id }, select: { id: true },
            });
            if (!project) return respond(404, { success: false, message: '项目不存在' });
        }
        return respond(503, { success: false, error: 'SOLAR_DATA_UNAVAILABLE',
            message: '深度光伏测算暂不可用，辐照数据来源与计算流程正在核验' });
    } catch {
        return respond(503, { success: false, message: '服务暂不可用，请稍后重试' });
    }
}

export async function GET() {
    return respond(410, {
        success: false, error: 'CALCULATION_ID_REQUIRED',
        message: '该旧接口没有计算记录编号，无法安全读取历史结果。请通过审计记录接口按编号查询。',
    });
}
