/** Resolve the map search box. Coordinates are "lat,lng"; anything else goes to the existing geocode route. */

export const MAP_SEARCH_MISS = '未找到该地点，请输入「纬度,经度」或更详细的地址';

export type MapSearchHit = { lat: number; lng: number; name: string };
export type MapSearchResult = MapSearchHit | { error: string };

function coordinatePair(text: string): MapSearchHit | 'invalid' | null {
    const parts = text.split(/[,，]/).map((part) => part.trim());
    if (parts.length !== 2 || parts.some((part) => part === '' || !Number.isFinite(Number(part)))) return null;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return 'invalid';
    return { lat, lng, name: text.trim() };
}

export async function resolveMapSearch(text: string, fetchImpl: typeof fetch = fetch): Promise<MapSearchResult> {
    const trimmed = text.trim();
    if (!trimmed) return { error: MAP_SEARCH_MISS };
    const typed = coordinatePair(trimmed);
    if (typed === 'invalid') return { error: MAP_SEARCH_MISS };
    if (typed) return typed;
    try {
        const response = await fetchImpl(`/api/location?action=geocode&address=${encodeURIComponent(trimmed)}`);
        const body = await response.json().catch(() => null);
        const hit = body?.data?.[0];
        const [lng, lat] = String(hit?.location ?? '').split(',').map(Number);
        if (!response.ok || !Number.isFinite(lat) || !Number.isFinite(lng)) return { error: MAP_SEARCH_MISS };
        return { lat, lng, name: typeof hit?.formatted_address === 'string' && hit.formatted_address ? hit.formatted_address : trimmed };
    } catch {
        return { error: MAP_SEARCH_MISS };
    }
}
