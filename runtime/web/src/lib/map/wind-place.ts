import { provinceFromPickedLocation } from './picked-province';

/** 风电选点。address 与 name 都是地名；地图点选可以只有坐标。 */
export interface WindPick {
    lat: number;
    lng: number;
    address?: string;
    name?: string;
    province?: string | null;
}

export interface WindPlaceFields {
    lat: number;
    lng: number;
    name: string;
    province: string;
}

/**
 * 把搜索或地图点选写进测算表单。
 * 坐标始终换成这次选中的点（不再留着打开页时的北京默认值）。
 * 这次带了地名就用这次的；没带则保留原地名。省份沿用名单内的结果，对不上时保留原省份。
 */
export function applyWindPick<T extends WindPlaceFields>(current: T, picked: WindPick): T {
    const lat = Number(picked.lat);
    const lng = Number(picked.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return current;
    const named = picked.name !== undefined ? picked.name : picked.address;
    return {
        ...current,
        lat,
        lng,
        name: named === undefined ? current.name : named.trim(),
        province: provinceFromPickedLocation(current.province, picked.province),
    };
}
