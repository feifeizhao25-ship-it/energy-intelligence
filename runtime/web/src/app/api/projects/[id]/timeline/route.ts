// 项目时间线 API

import { NextRequest, NextResponse } from 'next/server';
import { getProjectTimeline, type TimelineEventType } from '@/lib/audit';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

/**
 * GET /api/projects/[id]/timeline
 * 获取项目时间线
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const projectId = params.id;
        const searchParams = request.nextUrl.searchParams;

        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const types = searchParams.get('types')?.split(',') as TimelineEventType[] | undefined;
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const milestonesOnly = searchParams.get('milestonesOnly') === 'true';

        const timeline = await getProjectTimeline(projectId, {
            limit,
            offset,
            types,
            startDate,
            endDate,
            milestonesOnly,
        });

        return NextResponse.json(timeline);

    } catch (error) {
        console.error('Timeline API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch timeline' },
            { status: 500 }
        );
    }
}
