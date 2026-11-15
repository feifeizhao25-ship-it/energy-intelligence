import { NextResponse } from 'next/server';
import { loadOwnedSamples, monitoringResponse } from '@/lib/maintenance/project-telemetry';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    const loaded = await loadOwnedSamples(id);
    if ('error' in loaded) return loaded.error;
    return monitoringResponse(loaded.points);
}

export async function POST() {
    return NextResponse.json({ error: '请使用遥测接入接口写入数据' }, { status: 405 });
}
