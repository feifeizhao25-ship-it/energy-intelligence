import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

const respond = (status: number, body: object) => NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store' },
});

async function owner(projectId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { error: respond(401, { success: false, message: '请先登录' }) };
    const userId = session.user.id;
    const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
    if (!project) return { error: respond(404, { success: false, message: '项目不存在' }) };
    return { userId };
}

// 原链路包含模拟辐照来源、评分与未持久化的里程碑，完成验证前不得输出投资结论。
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const access = await owner((await props.params).id);
        if (access.error) return access.error;
        return respond(503, { success: false, error: 'ANALYSIS_UNAVAILABLE',
            message: '项目深度分析暂不可用，数据来源与计算流程正在核验，请勿据此作出投资决策' });
    } catch {
        return respond(503, { success: false, message: '服务暂不可用，请稍后重试' });
    }
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const { id: projectId } = await props.params;
        const access = await owner(projectId);
        if (access.error) return access.error;
        // 同时限定用户和项目，防止历史脏数据或孤立时间线跨用户泄露。
        const records = await prisma.projectTimeline.findMany({
            where: { projectId, userId: access.userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
            select: { id: true, type: true, title: true, description: true, createdAt: true, tags: true },
        });
        return respond(200, { success: true,
            timeline: { milestones: records.map(record => ({
                id: record.id, milestoneType: record.type, title: record.title,
                summary: record.description, createdAt: record.createdAt, tags: record.tags,
            })), stats: null },
            currentState: null,
            meta: { limit: 20, source: '数据库历史记录', analysisAvailable: false,
                message: '仅展示已保存的历史记录；历史内容不代表已通过数据来源或审计核验，当前评分暂不可用' },
        });
    } catch {
        return respond(503, { success: false, message: '暂时无法读取项目历史，请稍后重试' });
    }
}
