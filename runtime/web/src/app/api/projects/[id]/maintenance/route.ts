import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownedProject } from '@/lib/projects/owned';

/**
 * 项目维护任务：周计划只读，工单可创建、分派、改状态并留审计记录。
 */
type RouteContext = { params: Promise<{ id: string }> };

interface PlanTask {
    id?: string; title?: string; description?: string; type?: string; status?: string;
    priority?: string; scheduledDate?: string; estimatedDuration?: number; assignedTo?: string; devices?: string[];
}

const TYPES = new Set(['cleaning', 'inspection', 'repair', 'other']);
const STATUSES = new Set(['scheduled', 'in_progress', 'completed', 'cancelled']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

async function guard(params: RouteContext['params']) {
    const { id } = await params;
    const project = await ownedProject(id);
    if (project === 'unauthenticated') return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
    if (!project) return { error: NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 }) };
    return { project };
}

async function notifyWecom(text: string) {
    const key = process.env.NENGJIAN_WECOM_ROBOT_KEY?.trim();
    if (!key) return { sent: false, reason: '未配置企微机器人' };
    try {
        const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ msgtype: 'text', text: { content: text.slice(0, 500) } }),
        });
        return { sent: response.ok, reason: response.ok ? 'sent' : 'wecom_rejected' };
    } catch {
        return { sent: false, reason: 'wecom_unreachable' };
    }
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const status = new URL(req.url).searchParams.get('status');
    const plans = await prisma.maintenancePlan.findMany({ where: { projectId: g.project.id }, orderBy: { weekOf: 'desc' }, take: 12 });
    const orders = await prisma.workOrder.findMany({
        where: { projectId: g.project.id },
        orderBy: { createdAt: 'desc' },
        include: { attachments: { select: { id: true, filename: true, contentType: true, sizeBytes: true } } },
    });
    let tasks = [
        ...plans.flatMap((plan) => (Array.isArray(plan.tasks) ? (plan.tasks as PlanTask[]) : []).map((t, i) => ({
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
            source: 'plan',
            attachments: [],
        }))),
        ...orders.map((order) => ({
            id: order.id,
            title: order.title,
            description: order.description,
            type: order.type,
            status: order.status,
            priority: order.priority,
            scheduledDate: (order.dueAt ?? order.createdAt).toISOString(),
            estimatedDuration: null,
            assignedTo: order.assignee,
            devices: [],
            source: 'work_order',
            attachments: order.attachments,
        })),
    ];
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

export async function POST(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const body = await req.json().catch(() => null);
    const title = String(body?.title || '').trim();
    const type = String(body?.type || '');
    const priority = String(body?.priority || 'medium');
    if (!title || title.length > 80 || !TYPES.has(type) || !PRIORITIES.has(priority)) {
        return NextResponse.json({ error: '请填写标题、类型（清洗、巡检、检修或其他）和优先级' }, { status: 400 });
    }
    const assignee = typeof body?.assignee === 'string' ? body.assignee.trim().slice(0, 40) : null;
    const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: '截止日期无效' }, { status: 400 });
    const order = await prisma.workOrder.create({
        data: {
            projectId: g.project.id,
            title,
            description: String(body?.description || '').slice(0, 2000),
            type,
            priority,
            assignee: assignee || null,
            dueAt,
            createdBy: g.project.userId,
            events: { create: { actorId: g.project.userId, action: 'created', detail: { assignee } } },
        },
    });
    const notify = await notifyWecom(`新工单 ${order.title}（${type}）已创建。`);
    await prisma.workOrderEvent.create({ data: { workOrderId: order.id, actorId: g.project.userId, action: 'notify', detail: notify } });
    return NextResponse.json({ success: true, data: { id: order.id, notify } }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const status = body?.status ? String(body.status) : undefined;
    if (!id || (status && !STATUSES.has(status))) return NextResponse.json({ error: '请提供工单和有效状态' }, { status: 400 });
    const existing = await prisma.workOrder.findFirst({ where: { id, projectId: g.project.id } });
    if (!existing) return NextResponse.json({ error: '工单不存在' }, { status: 404 });
    const assignee = body?.assignee === undefined ? undefined : String(body.assignee).trim().slice(0, 40);
    const updated = await prisma.workOrder.update({
        where: { id },
        data: {
            ...(status ? { status } : {}),
            ...(assignee !== undefined ? { assignee: assignee || null } : {}),
        },
    });
    await prisma.workOrderEvent.create({
        data: { workOrderId: id, actorId: g.project.userId, action: 'updated', detail: { status: updated.status, assignee: updated.assignee } },
    });
    if (status) await notifyWecom(`工单 ${updated.title} 状态改为 ${updated.status}。`);
    return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status, assignee: updated.assignee } });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const body = await req.json().catch(() => null);
    const workOrderId = String(body?.workOrderId || '');
    const filename = String(body?.filename || '').trim();
    const contentBase64 = String(body?.contentBase64 || '');
    if (!workOrderId || !filename || filename.length > 120 || !contentBase64) {
        return NextResponse.json({ error: '请提供工单、文件名和附件内容' }, { status: 400 });
    }
    const order = await prisma.workOrder.findFirst({ where: { id: workOrderId, projectId: g.project.id } });
    if (!order) return NextResponse.json({ error: '工单不存在' }, { status: 404 });
    let content: Buffer;
    try { content = Buffer.from(contentBase64, 'base64'); } catch { return NextResponse.json({ error: '附件内容无法读取' }, { status: 400 }); }
    if (!content.length || content.length > 1_000_000) return NextResponse.json({ error: '附件不能为空，且不超过 1MB' }, { status: 400 });
    const saved = await prisma.workOrderAttachment.create({
        data: { workOrderId, filename, contentType: String(body?.contentType || 'application/octet-stream').slice(0, 80), sizeBytes: content.length, content },
    });
    await prisma.workOrderEvent.create({
        data: { workOrderId, actorId: g.project.userId, action: 'attachment', detail: { filename, sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length } },
    });
    return NextResponse.json({ success: true, data: { id: saved.id, filename: saved.filename, sizeBytes: saved.sizeBytes } }, { status: 201 });
}
