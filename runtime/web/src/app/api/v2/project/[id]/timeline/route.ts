/**
 * 🏰 护城河系统：项目时间线 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { timelineService } from '@/lib/timeline/service';
import { ownedProject } from '@/lib/projects/owned';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    // 原来不校验身份：知道项目 id 就能读任何人的项目时间线
    const project = await ownedProject(params.id);
    if (project === 'unauthenticated') return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });
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
