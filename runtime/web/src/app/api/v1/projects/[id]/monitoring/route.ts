import { NextRequest, NextResponse } from 'next/server';
import { withOpenApi } from '@/lib/api/open-api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringSeries, type TelemetryPoint } from '@/lib/maintenance/telemetry';

async function handleGetMonitoring(req: NextRequest, keyData: { userId: string }) {
    const match = req.nextUrl.pathname.match(/\/api\/v1\/projects\/([^/]+)\/monitoring\/?$/);
    const projectId = match?.[1] ? decodeURIComponent(match[1]) : '';
    if (!projectId) {
        return NextResponse.json({ success: false, error: 'PROJECT_REQUIRED', message: '请指定项目' }, { status: 400 });
    }
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: keyData.userId }, select: { id: true } });
    if (!project) {
        return NextResponse.json({ success: false, error: 'NOT_FOUND', message: '项目不存在或无权访问' }, { status: 404 });
    }
    const rows = await prisma.telemetrySample.findMany({
        where: { projectId },
        orderBy: { recordedAt: 'asc' },
        take: 5000,
    });
    if (!rows.length) {
        return NextResponse.json({
            success: false,
            error: 'TELEMETRY_NOT_CONNECTED',
            message: '尚未接入经验证的遥测数据，系统不提供合成的监测数据。',
        }, { status: 503 });
    }
    const points: TelemetryPoint[] = rows.map((row) => ({
        pointId: row.pointId,
        recordedAt: row.recordedAt,
        powerKw: row.powerKw,
        energyKwh: row.energyKwh,
        irradiance: row.irradiance,
        alarmCode: row.alarmCode,
        source: row.source as TelemetryPoint['source'],
    }));
    return NextResponse.json({ success: true, data: monitoringSeries(points) });
}

export const GET = withOpenApi(handleGetMonitoring, 'read:monitoring');
