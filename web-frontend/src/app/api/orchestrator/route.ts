// 项目生命周期编排器 API
// GET /api/orchestrator?projectId=xxx

import { NextRequest, NextResponse } from 'next/server';
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
        let projectId = request.nextUrl.searchParams.get('projectId');
        if (!projectId) {
            return NextResponse.json(
                { error: 'Bad Request', message: '缺少 projectId 参数' },
                { status: 400 }
            );
        }

        // 如果是 "current"，获取用户的第一个项目或使用演示项目
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
                    // 没有项目时返回演示数据
                    projectId = 'demo-project';
                }

                await prisma.$disconnect();
            } catch (err) {
                console.error('Error fetching user project:', err);
                projectId = 'demo-project';
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
