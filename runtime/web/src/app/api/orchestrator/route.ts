// 项目生命周期编排器 API
// GET /api/orchestrator?projectId=xxx

import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { buildOrchestratorResponse } from '@/lib/orchestrator';

export async function GET(request: NextRequest) {
    try {
        // 获取用户会话
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized', message: '请先登录' },
                { status: 401 }
            );
        }

        // 获取项目 ID
        //
        // searchParams.get() 的返回类型是 string | null。此前直接用 let 承接，
        // 早返回只窄化了值、没有窄化声明类型，经过下面的 try/catch 与 await 后
        // 控制流分析失效，projectId 在传参处仍被视为 string | null —— 构建报错。
        // 这里显式声明为 string。
        const rawProjectId = request.nextUrl.searchParams.get('projectId');
        if (!rawProjectId) {
            return NextResponse.json(
                { error: 'Bad Request', message: '缺少 projectId 参数' },
                { status: 400 }
            );
        }
        let projectId: string = rawProjectId;

        // 如果是 "current"，仅获取当前用户真实存在的最近项目。
        if (projectId === 'current') {
            try {
                const { PrismaClient } = await import('@prisma/client');
                const prisma = new PrismaClient();

                // 尝试获取用户的第一个项目
                const userProject = await prisma.project.findFirst({
                    where: { userId: session.user.id },
                    orderBy: { createdAt: 'desc' },
                });

                if (userProject) {
                    projectId = userProject.id;
                } else {
                    await prisma.$disconnect();
                    return NextResponse.json(
                        { error: 'Not Found', message: '当前账号还没有项目，请先创建项目' },
                        { status: 404 }
                    );
                }

                await prisma.$disconnect();
            } catch (err) {
                console.error('Error fetching user project:', err);
                return NextResponse.json(
                    { error: 'Service Unavailable', message: '项目数据暂时不可用' },
                    { status: 503 }
                );
            }
        }

        // 构建编排器响应
        const response = await buildOrchestratorResponse(
            projectId,
            session.user.id
        );

        return NextResponse.json(response);
    } catch (error) {
        console.error('Orchestrator API error:', error);
        return NextResponse.json(
            {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : '服务器内部错误'
            },
            { status: 500 }
        );
    }
}
