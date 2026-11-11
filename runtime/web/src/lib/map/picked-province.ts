/**
 * 把地理编码里的省名收成国内省级简称（与个人设置、电价表同一张名单）。
 * 对不上名单时返回空字符串，不另造一个省名。
 */
import { PROVINCES } from '@/lib/dashboard/personalization';
import { normalizeProvince } from '@/lib/pricing/tariffs';

const PROVINCE_NAMES = [...PROVINCES].sort((a, b) => b.length - a.length);

function asText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
        for (const item of value) {
            if (typeof item === 'string' && item.trim()) return item.trim();
        }
    }
    return '';
}

function provinceLeading(address: string): string {
    const text = address.replace(/^中国/, '').trim();
    return PROVINCE_NAMES.find((name) => text.startsWith(name)) ?? '';
}

function listed(name: string): string {
    const normalized = normalizeProvince(name);
    return normalized && (PROVINCES as readonly string[]).includes(normalized) ? normalized : '';
}

/** 高德地理编码或逆地理编码里的省，收成名单内简称。 */
export function provinceFromGeocodeRecord(record: unknown): string {
    const hit = record && typeof record === 'object' ? record as Record<string, unknown> : null;
    if (!hit) return '';
    const component = hit.addressComponent && typeof hit.addressComponent === 'object'
        ? hit.addressComponent as Record<string, unknown>
        : null;
    const raw = asText(hit.province)
        || asText(component?.province)
        || provinceLeading(asText(hit.formatted_address) || asText(hit.formattedAddress));
    return listed(raw);
}

/**
 * 选点之后的省份。地理编码给出名单内的省就用它；没有或对不上时保留原来的省，避免被清空。
 */
export function provinceFromPickedLocation(current: string, picked?: string | null): string {
    return listed(picked ?? '') || current;
}
