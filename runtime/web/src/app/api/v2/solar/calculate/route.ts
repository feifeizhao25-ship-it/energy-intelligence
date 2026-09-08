import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { SolarCalculatorV2 } from '@/lib/calculator/solar-v2';
import { saveSolar, SolarAccessError } from '@/lib/calculator/save-solar';

const respond = (status: number, body: object) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store' },
});

// 仅提供有来源证据的初步估算；不接受客户端指定审计等级。
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
        const result = await SolarCalculatorV2.calculate(body);
        const snapshotId = await saveSolar(session.user.id, body.projectId ?? null, result);
        return respond(200, { success: true, data: { ...result, snapshotId }, meta: { persisted: true, qualityTag: 'PREVIEW' } });
    } catch (error) {
        if (error instanceof SolarAccessError) return respond(error.status, { success: false, message: error.message });
        if (error instanceof Error && ['INVALID_SOLAR_INPUT', 'INVALID_COORDINATES', 'INVALID_QUALITY_TAG'].includes(error.message)) {
            return respond(400, { success: false, message: '测算参数无效，请检查位置、容量、成本和电价' });
        }
        if (error instanceof Error && error.message === 'AUDIT_GRADE_UNAVAILABLE') return respond(422, {
            success: false, message: '当前只提供初步估算，暂不支持审计级报告',
        });
        return respond(503, { success: false, message: '服务暂不可用，请稍后重试' });
    }
}

export async function GET() {
    return respond(410, {
        success: false, error: 'CALCULATION_ID_REQUIRED',
        message: '该旧接口没有计算记录编号，无法安全读取历史结果。请通过审计记录接口按编号查询。',
    });
}
