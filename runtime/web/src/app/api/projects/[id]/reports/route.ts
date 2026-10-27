import { loadOwnedSamples, reportResponse } from '@/lib/maintenance/project-telemetry';

type RouteContext = { params: Promise<{ id: string }> };

async function handle(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    const loaded = await loadOwnedSamples(id);
    if ('error' in loaded) return loaded.error;
    return reportResponse(loaded.points);
}

export const GET = handle;
export const POST = handle;
