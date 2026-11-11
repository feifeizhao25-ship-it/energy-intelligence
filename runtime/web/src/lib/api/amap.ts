import { gcj02LocationToWgs84, wgs84ToGcj02Location } from '@/lib/map/gcj02';

const AMAP_API = 'https://restapi.amap.com/v3';

/**
 * 高德 **Web 服务** Key。只从服务端环境变量读。
 *
 * 原来这里有一条兜底：`|| process.env.NEXT_PUBLIC_AMAP_KEY`。
 * Next.js 会把任何 `NEXT_PUBLIC_*` **内联进浏览器包**——也就是说
 * 一旦有人把 Web 服务 Key 配到那个变量上，这个 Key 就随首页一起
 * 发给了每一个访客，任何人打开 devtools 都能拿走。
 *
 * 这个文件只在服务端（route handler）里跑，没有任何理由读公开变量，
 * 所以把兜底去掉：**配错了就明确报"未配置"，而不是悄悄用一个会泄露的 Key。**
 *
 * 页面上的地图不加载 JS SDK，也不读取 `NEXT_PUBLIC_AMAP_*`。
 * 安全密钥不能放到浏览器。若以后要加载 JS SDK，只能把
 * `_AMapSecurityConfig.serviceHost` 指到服务端代理。
 */
export class AmapError extends Error {
  readonly code: 'not_found' | 'upstream';
  readonly httpStatus: number;
  constructor(message: string, code: 'not_found' | 'upstream', httpStatus: number) {
    super(message);
    this.name = 'AmapError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function apiKey(): string {
  const key = process.env.AMAP_WEB_SERVICE_KEY;
  if (!key) throw new Error('位置服务未配置（缺少 AMAP_WEB_SERVICE_KEY）');
  return key;
}

async function request(path: string, parameters: Record<string, string>) {
  const query = new URLSearchParams({ ...parameters, key: apiKey(), output: 'JSON' });
  const response = await fetch(`${AMAP_API}/${path}?${query}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new AmapError('位置服务请求失败', 'upstream', 503);
  const payload = await response.json();
  if (payload.status !== '1') {
    if (payload.info === 'ENGINE_RESPONSE_DATA_ERROR') throw new AmapError('未找到该地点', 'not_found', 404);
    throw new AmapError('位置服务返回错误', 'upstream', 503);
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

/** Amap sends GCJ-02. Callers store WGS84, so location strings are converted on the way out. */
function toStoredPlace<T>(place: T): T {
  const record = asRecord(place);
  if (!record || !('location' in record)) return place;
  return { ...record, location: gcj02LocationToWgs84(record.location) } as T;
}

export async function geocodeAddress(address: string) {
  const payload = await request('geocode/geo', { address });
  return (payload.geocodes ?? []).map(toStoredPlace);
}

export async function reverseGeocode(lat: number, lng: number) {
  const payload = await request('geocode/regeo', {
    location: wgs84ToGcj02Location(lat, lng),
    extensions: 'all',
  });
  const regeocode = asRecord(payload.regeocode);
  if (!regeocode) return null;
  const pois = Array.isArray(regeocode.pois) ? regeocode.pois.map(toStoredPlace) : regeocode.pois;
  return { ...regeocode, pois };
}

export async function searchNearbyPOIs(
  lat: number,
  lng: number,
  keywords: string[],
  radius = 5000,
) {
  const payload = await request('place/around', {
    location: wgs84ToGcj02Location(lat, lng),
    keywords: keywords.join('|'),
    radius: String(Math.min(Math.max(radius, 0), 50000)),
  });
  return (payload.pois ?? []).map(toStoredPlace);
}

export async function getLocationSuggestions(query: string) {
  const payload = await request('assistant/inputtips', { keywords: query });
  return (payload.tips ?? []).map(toStoredPlace);
}
