/**
 * WGS84 (what we store and what NASA uses) and GCJ-02 (what Amap returns).
 * Outside mainland China the offset is zero. The inverse is the usual one-step estimate.
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

export interface LngLat {
    lng: number;
    lat: number;
}

export function outOfChina(lat: number, lng: number): boolean {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

function transformLng(x: number, y: number): number {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

export function wgs84ToGcj02(lat: number, lng: number): LngLat {
    if (outOfChina(lat, lng)) return { lat, lng };
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
    return { lat: lat + dLat, lng: lng + dLng };
}

export function gcj02ToWgs84(lat: number, lng: number): LngLat {
    if (outOfChina(lat, lng)) return { lat, lng };
    const shifted = wgs84ToGcj02(lat, lng);
    return { lat: lat * 2 - shifted.lat, lng: lng * 2 - shifted.lng };
}

export function formatLngLat(lng: number, lat: number): string {
    return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

/** Amap location strings are "lng,lat" in GCJ-02. Stored coordinates are WGS84. */
export function gcj02LocationToWgs84(location: unknown): string | unknown {
    if (typeof location !== 'string' || !location.includes(',')) return location;
    const [lngText, latText] = location.split(',');
    const lng = Number(lngText);
    const lat = Number(latText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return location;
    const wgs = gcj02ToWgs84(lat, lng);
    return formatLngLat(wgs.lng, wgs.lat);
}

export function wgs84ToGcj02Location(lat: number, lng: number): string {
    const gcj = wgs84ToGcj02(lat, lng);
    return formatLngLat(gcj.lng, gcj.lat);
}
