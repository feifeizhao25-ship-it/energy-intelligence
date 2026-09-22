import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownedProject } from '@/lib/projects/owned';

/**
 * 项目维护任务：读数据库 maintenance_plans（按周生成的计划，任务存在 tasks JSON 里），
 * 只对项目所有者开放。
 *
 * 原来这里是进程内存里的一个 Map，预置了「光伏组件清洗」「3号逆变器散热检修」等演示工单，
 * 不登录就能读写任意项目，重启即丢。
 */
type RouteContext = { params: Promise<{ id: string }> };

interface PlanTask {
    id?: string; title?: string; description?: string; type?: string; status?: string;
    priority?: string; scheduledDate?: string; estimatedDuration?: number; assignedTo?: string; devices?: string[];
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    const { id } = await params;
    const project = await ownedProject(id);
    if (project === 'unauthenticated') return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });

    const status = new URL(req.url).searchParams.get('status');
    const plans = await prisma.maintenancePlan.findMany({ where: { projectId: project.id }, orderBy: { weekOf: 'desc' }, take: 12 });
    let tasks = plans.flatMap((plan) => (Array.isArray(plan.tasks) ? (plan.tasks as PlanTask[]) : []).map((t, i) => ({
        id: t.id ?? `${plan.id}-${i}`,
        title: t.title ?? '维护任务',
        description: t.description ?? '',
        type: t.type ?? 'inspection',
        status: t.status ?? (plan.completed ? 'completed' : 'scheduled'),
        priority: t.priority ?? 'medium',
        scheduledDate: t.scheduledDate ?? plan.weekOf.toISOString(),
        estimatedDuration: t.estimatedDuration ?? null,
        assignedTo: t.assignedTo ?? null,
        devices: Array.isArray(t.devices) ? t.devices : [],
    })));
    if (status && status !== 'all') tasks = tasks.filter((t) => t.status === status);

    return NextResponse.json({
        success: true,
        data: {
            tasks,
            summary: {
                total: tasks.length,
                scheduled: tasks.filter((t) => t.status === 'scheduled').length,
                inProgress: tasks.filter((t) => t.status === 'in_progress').length,
                completed: tasks.filter((t) => t.status === 'completed').length,
                urgent: tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length,
            },
        },
    });
}

const NOT_AVAILABLE = () => NextResponse.json({
    error: 'MAINTENANCE_WRITE_UNAVAILABLE',
    message: '维护计划由项目激活后的分析任务按周生成，手动建单与改单尚未开放',
}, { status: 501 });

export const POST = NOT_AVAILABLE;
export const PATCH = NOT_AVAILABLE;
