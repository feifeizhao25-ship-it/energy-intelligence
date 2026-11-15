/**
 * 遗留前端没有高德实现。现网地理编码在 runtime/web。
 * 这里只补上被引用的模块，让这个目录能编译。不请求高德，也不回退到 Nominatim。
 */

function unavailable(): never {
    throw new Error('遗留前端不提供地图。请直接填写经纬度，或使用 runtime/web。');
}

export async function geocodeAddress(_address: string) {
    return unavailable();
}

export async function reverseGeocode(_lat: number, _lng: number) {
    return unavailable();
}

export async function searchNearbyPOIs(_lat: number, _lng: number, _keywords: string[], _radius = 5000) {
    return unavailable();
}

export async function getLocationSuggestions(_query: string) {
    return unavailable();
}
