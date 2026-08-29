import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const projectId = params.id;

    try {
        const project = await prisma.project.findFirst({
            where: { id: projectId, userId: session.user.id },
            include: {
                stations: { select: { dailyEnergy: true, totalEnergy: true, lastUpdated: true } },
                dailyAnalyses: { orderBy: { analysisDate: 'desc' }, take: 7 },
                alerts: { orderBy: { createdAt: 'desc' }, take: 10 },
            }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: project });
    } catch (error) {
        console.error('Failed to fetch project:', error);
        return NextResponse.json({ error: 'Project service unavailable' }, { status: 503 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    try {
        await prisma.project.delete({
            where: {
                id: params.id,
                userId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete project:', error);
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }
}
