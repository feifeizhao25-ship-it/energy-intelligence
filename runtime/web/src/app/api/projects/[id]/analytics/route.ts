import { analyticsResponse, loadOwnedSamples } from '@/lib/maintenance/project-telemetry';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
    const { id } = await params;
    const loaded = await loadOwnedSamples(id);
    if ('error' in loaded) return loaded.error;
    return analyticsResponse(loaded.points);
}
