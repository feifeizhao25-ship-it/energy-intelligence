import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownedProject } from '@/lib/projects/owned';

type RouteContext = { params: Promise<{ id: string }> };
const METRICS = new Set(['power_kw', 'irradiance', 'alarm_code']);
const OPERATORS = new Set(['gt', 'lt', 'present']);

async function guard(params: RouteContext['params']) {
    const { id } = await params;
    const project = await ownedProject(id);
    if (project === 'unauthenticated') return { error: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
    if (!project) return { error: NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 }) };
    return { project };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const [rules, events, samples] = await Promise.all([
        prisma.alarmRule.findMany({ where: { projectId: g.project.id }, orderBy: { createdAt: 'desc' } }),
        prisma.alarmEvent.findMany({ where: { projectId: g.project.id }, orderBy: { createdAt: 'desc' }, take: 200 }),
        prisma.telemetrySample.count({ where: { projectId: g.project.id } }),
    ]);
    if (samples === 0 && rules.length === 0) {
        return NextResponse.json({
            success: false,
            error: 'TELEMETRY_NOT_CONNECTED',
            message: '还没有遥测，也没有阈值。系统不会生成告警。',
        }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: { rules, events, telemetryConnected: samples > 0 } });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const body = await req.json().catch(() => null);
    const metric = String(body?.metric || '');
    const operator = String(body?.operator || '');
    const threshold = Number(body?.threshold);
    if (!METRICS.has(metric) || !OPERATORS.has(operator) || !Number.isFinite(threshold)) {
        return NextResponse.json({ error: '请设置指标、比较方式和数字阈值' }, { status: 400 });
    }
    const rule = await prisma.alarmRule.create({
        data: { projectId: g.project.id, metric, operator, threshold, severity: String(body?.severity || 'warning').slice(0, 20) },
    });
    return NextResponse.json({ success: true, data: rule }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
    const g = await guard(params);
    if ('error' in g) return g.error;
    const body = await req.json().catch(() => null);
    const id = String(body?.id || '');
    const updated = await prisma.alarmEvent.updateMany({
        where: { id, projectId: g.project.id },
        data: { status: 'acknowledged', acknowledgedAt: new Date() },
    });
    if (!updated.count) return NextResponse.json({ error: '告警不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
}
