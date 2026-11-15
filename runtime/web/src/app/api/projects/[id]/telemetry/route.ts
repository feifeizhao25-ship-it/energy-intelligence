import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownedProject } from '@/lib/projects/owned';
import { parseTelemetryCsv, parseTelemetryJson, ruleMatches, type AlarmRuleInput, type TelemetryPoint } from '@/lib/maintenance/telemetry';

type RouteContext = { params: Promise<{ id: string }> };

async function projectByToken(projectId: string, header: string | null) {
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const credential = await prisma.telemetryCredential.findFirst({ where: { projectId, tokenHash, revokedAt: null } });
    return credential ? { id: projectId, userId: 'ingest' } : null;
}

async function authorize(params: RouteContext['params'], req: NextRequest) {
    const { id } = await params;
    const byToken = await projectByToken(id, req.headers.get('authorization'));
    if (byToken) return { project: byToken };
    const project = await ownedProject(id);
    if (project === 'unauthenticated') return { error: NextResponse.json({ error: '请先登录或提供接入令牌' }, { status: 401 }) };
    if (!project) return { error: NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 }) };
    return { project };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    const auth = await authorize(params, req);
    if ('error' in auth) return auth.error;
    const contentType = req.headers.get('content-type') || '';
    let points: TelemetryPoint[];
    try {
        if (contentType.includes('text/csv')) points = parseTelemetryCsv(await req.text());
        else points = parseTelemetryJson(await req.json());
    } catch {
        return NextResponse.json({ error: '遥测格式不正确' }, { status: 400 });
    }
    await prisma.telemetrySample.createMany({
        data: points.map((point) => ({
            projectId: auth.project.id,
            pointId: point.pointId,
            recordedAt: point.recordedAt,
            powerKw: point.powerKw,
            energyKwh: point.energyKwh,
            irradiance: point.irradiance,
            alarmCode: point.alarmCode,
            source: point.source,
        })),
    });
    const rules = await prisma.alarmRule.findMany({ where: { projectId: auth.project.id, enabled: true } });
    let alarms = 0;
    for (const point of points) {
        for (const rule of rules) {
            const match = ruleMatches(rule as AlarmRuleInput, point);
            if (!match.breached) continue;
            await prisma.alarmEvent.create({
                data: {
                    projectId: auth.project.id,
                    ruleId: rule.id,
                    severity: rule.severity,
                    title: rule.metric === 'alarm_code' ? `点位 ${point.pointId} 上报告警码 ${point.alarmCode}` : `点位 ${point.pointId} 的 ${rule.metric} 超出阈值`,
                    observed: match.observed,
                    threshold: rule.threshold,
                },
            });
            alarms += 1;
        }
    }
    return NextResponse.json({ success: true, data: { accepted: points.length, alarms } }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
    const { id } = await params;
    const project = await ownedProject(id);
    if (project === 'unauthenticated') return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const token = randomBytes(24).toString('hex');
    await prisma.telemetryCredential.create({
        data: { projectId: project.id, tokenHash: createHash('sha256').update(token).digest('hex'), label: String(body?.label || '网关').slice(0, 40) },
    });
    return NextResponse.json({
        success: true,
        data: { token, hint: '令牌只显示这一次。请求头使用 Authorization: Bearer。没有令牌或没有入库数据时，监控接口仍返回 503。' },
    }, { status: 201 });
}
