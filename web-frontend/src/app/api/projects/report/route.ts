import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { generateComparisonReport } from '@/lib/reports/comparison-report';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    let userId = session?.user?.id || 'dev-master-id';

    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const aiExplanation = searchParams.get('aiExplanation') || undefined;

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (project.userId !== userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (project.reportStatus !== 'unlocked' && project.reportStatus !== 'READY') {
            return NextResponse.json({ error: 'Report is locked' }, { status: 402 });
        }

        const comparisonResult = project.comparisonResult as any;
        if (!comparisonResult) {
            return NextResponse.json({ error: 'Comparison data missing from project' }, { status: 500 });
        }

        // 生成报告
        const blob = await generateComparisonReport({
            result: comparisonResult,
            projectName: project.name,
            author: session?.user?.name || '系统自动生成',
            aiExplanation: aiExplanation // 优先使用传入的解释（通常是最新的）
        });

        const buffer = Buffer.from(await blob.arrayBuffer());

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="Engineering_Report_${project.id}.docx"`,
            },
        });
    } catch (error) {
        console.error('Failed to generate report:', error);
        return NextResponse.json({
            error: 'Failed to generate report',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
