import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownedProject } from '@/lib/projects/owned';
import { monitoringSeries, performanceFromSamples, type TelemetryPoint } from '@/lib/maintenance/telemetry';

const UNAVAILABLE = {
    success: false,
    error: 'TELEMETRY_NOT_CONNECTED',
    message: '该项目尚未入库经验证的 SCADA/IoT 遥测，系统不会生成模拟监控、报告或性能曲线。',
};

export async function loadOwnedSamples(projectId: string) {
    const project = await ownedProject(projectId);
    if (project === 'unauthenticated') return { error: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
    if (!project) return { error: NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 }) };
    const rows = await prisma.telemetrySample.findMany({
        where: { projectId: project.id },
        orderBy: { recordedAt: 'asc' },
        take: 5000,
    });
    if (!rows.length) return { error: NextResponse.json(UNAVAILABLE, { status: 503 }) };
    const points: TelemetryPoint[] = rows.map((row) => ({
        pointId: row.pointId,
        recordedAt: row.recordedAt,
        powerKw: row.powerKw,
        energyKwh: row.energyKwh,
        irradiance: row.irradiance,
        alarmCode: row.alarmCode,
        source: row.source as TelemetryPoint['source'],
    }));
    return { project, points };
}

export function monitoringResponse(points: TelemetryPoint[]) {
    return NextResponse.json({ success: true, data: monitoringSeries(points) });
}

export function reportResponse(points: TelemetryPoint[]) {
    const series = monitoringSeries(points);
    const energy = points.reduce((sum, point) => sum + (point.energyKwh ?? 0), 0);
    return NextResponse.json({
        success: true,
        data: {
            title: '遥测汇总',
            sampleCount: series.summary.sampleCount,
            energyKwh: Math.round(energy * 1000) / 1000,
            from: series.summary.from,
            to: series.summary.to,
            note: '本报告只汇总已入库遥测，不外推发电量，也不给出投资结论。',
        },
    });
}

export function analyticsResponse(points: TelemetryPoint[]) {
    return NextResponse.json({ success: true, data: performanceFromSamples(points) });
}
