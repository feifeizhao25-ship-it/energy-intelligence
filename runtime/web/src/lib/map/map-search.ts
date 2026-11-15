import { provinceFromGeocodeRecord } from './picked-province';

/** Resolve the map search box. Coordinates are "lat,lng"; anything else goes to the existing geocode route. */

export const MAP_SEARCH_MISS = '未找到该地点，请输入「纬度,经度」或更详细的地址';

export type MapSearchHit = { lat: number; lng: number; name: string; province?: string };
export type MapSearchFailure = { error: string; code?: 'not_found' | 'key_missing' | 'upstream' };
export type MapSearchResult = MapSearchHit | MapSearchFailure;

export function windPickerSearchNote(result: MapSearchFailure): string {
    if (result.code === 'key_missing') return '地图服务暂不可用，地图未配置密钥，请直接填写经纬度';
    return result.error;
}

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
        const code = typeof body?.code === 'string' ? body.code : undefined;
        if (code === 'key_missing') return { error: '地图未配置密钥，请直接填写经纬度', code: 'key_missing' };
        const hit = body?.data?.[0];
        const [lng, lat] = String(hit?.location ?? '').split(',').map(Number);
        if (!response.ok || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            const failure = code === 'not_found' || response.status === 404 || response.ok ? 'not_found' : 'upstream';
            return { error: MAP_SEARCH_MISS, code: failure };
        }
        const name = typeof hit?.formatted_address === 'string' && hit.formatted_address ? hit.formatted_address : trimmed;
        const province = provinceFromGeocodeRecord(hit);
        return province ? { lat, lng, name, province } : { lat, lng, name };
    } catch {
        return { error: MAP_SEARCH_MISS };
    }
}
