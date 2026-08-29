/**
 * 🏰 护城河系统：项目时间线 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { timelineService } from '@/lib/timeline/service';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const timeline = await timelineService.getTimeline(params.id);
        const recommendations = await timelineService.recommendNextSteps(params.id);

        return NextResponse.json({
            timeline,
            recommendations
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
