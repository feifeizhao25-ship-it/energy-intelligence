import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownedProject } from '@/lib/projects/owned';

/**
 * 项目告警：读写数据库 asset_alerts，只对项目所有者开放。
 *
 * 原来这里是进程内存里的一个 Map，预置了「逆变器 #03 效率偏低」等演示告警；
 * 不登录就能读、能新建、能改任意项目的告警，重启即丢，多个实例之间互不相通。
 */
type RouteContext = { params: Promise<{ id: string }> };

const SEVERITY_TO_TYPE: Record<string, string> = { CRITICAL: 'error', HIGH: 'error', MEDIUM: 'warning', LOW: 'info' };
const STATUS_OUT: Record<string, string> = { ACTIVE: 'active', ACKNOWLEDGED: 'acknowledged', RESOLVED: 'resolved', IGNORED: 'ignored' };
const STATUS_IN: Record<string, 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED'> = { acknowledged: 'ACKNOWLEDGED', resolved: 'RESOLVED', ignored: 'IGNORED' };

async function guard(params: RouteContext['params']) {
    const { id } = await params;
    const project = await ownedProject(id);
    if (project === 'unauthenticated') return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
    if (!project) return { error: NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 }) };
    return { project };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const status = new URL(req.url).searchParams.get('status');
    const rows = await prisma.assetAlert.findMany({
        where: { projectId: g.project.id, ...(status && STATUS_IN[status] ? { status: STATUS_IN[status] } : status === 'active' ? { status: 'ACTIVE' } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
    });
    const alerts = rows.map((a) => ({
        id: a.id,
        type: SEVERITY_TO_TYPE[a.severity] ?? 'info',
        severity: a.severity,
        title: a.title,
        description: a.description,
        recommendation: a.recommendation,
        status: STATUS_OUT[a.status] ?? a.status,
        createdAt: a.createdAt,
        resolvedAt: a.resolvedAt,
    }));
    const active = alerts.filter((a) => a.status === 'active');
    return NextResponse.json({
        success: true,
        data: {
            alerts,
            summary: {
                total: alerts.length,
                active: active.length,
                errors: active.filter((a) => a.type === 'error').length,
                warnings: active.filter((a) => a.type === 'warning').length,
            },
        },
    });
}

// 告警由监控任务写入，不接受浏览器创建
export async function POST() {
    return NextResponse.json({ error: '告警由监控系统生成，不能手动创建' }, { status: 405 });
}

// 所有者确认 / 解决 / 忽略告警
export async function PATCH(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const body = await req.json().catch(() => ({}));
    const next = STATUS_IN[String(body?.status ?? '')];
    if (!body?.alertId || !next) return NextResponse.json({ error: '参数无效' }, { status: 400 });
    const now = new Date();
    const { count } = await prisma.assetAlert.updateMany({
        where: { id: String(body.alertId), projectId: g.project.id },
        data: {
            status: next,
            ...(next === 'ACKNOWLEDGED' ? { acknowledgedAt: now, acknowledgedBy: g.project.userId } : {}),
            ...(next === 'RESOLVED' ? { resolvedAt: now, resolvedBy: g.project.userId, resolutionNote: typeof body.note === 'string' ? body.note.slice(0, 500) : null } : {}),
        },
    });
    if (count === 0) return NextResponse.json({ error: '告警不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data: { id: body.alertId, status: STATUS_OUT[next] } });
}
