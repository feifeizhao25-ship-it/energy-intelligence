import { createHash } from 'crypto';
import { gcj02ToWgs84, wgs84ToGcj02, formatLngLat } from '@/lib/map/gcj02';

/**
 * 腾讯位置服务 **WebService API**（服务端）。LOCATION_PROVIDER=tencent 时由 location-provider 选用。
 *
 * - Key 只从服务端环境变量 TENCENT_MAP_KEY 读，不读任何 NEXT_PUBLIC_*，不写进返回值或日志。
 * - 控制台开启「签名校验（SN）」时配 TENCENT_MAP_SK：sig = md5(路径 + "?" + 按参数名升序拼接的原始参数 + SK)，
 *   见 https://lbs.qq.com/faq/serverFaq/webServiceKey 。不配 SK 时不带 sig（Key 需不限制来源或授权了出口 IP）。
 * - 腾讯与高德一样用 GCJ-02；库存和对外坐标用 WGS84，进出时转换。
 * - 返回值整理成与 amap.ts 相同的字段（formatted_address / addressComponent / location="lng,lat" / name …），
 *   页面和 AI 工具不用改。
 */
const TENCENT_HOST = 'https://apis.map.qq.com';

export class TencentMapError extends Error {
  readonly code: 'not_found' | 'upstream' | 'key_missing';
  readonly httpStatus: number;
  readonly upstreamStatus?: number;
  constructor(message: string, code: 'not_found' | 'upstream' | 'key_missing', httpStatus: number, upstreamStatus?: number) {
    super(message);
    this.name = 'TencentMapError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.upstreamStatus = upstreamStatus;
  }
}

function credentials(): { key: string; sk: string } {
  const key = (process.env.TENCENT_MAP_KEY || '').trim();
  if (!key) throw new TencentMapError('位置服务未配置', 'key_missing', 503);
  return { key, sk: (process.env.TENCENT_MAP_SK || '').trim() };
}

/** 腾讯 WebService GET 签名。参数用未编码的原始值，按参数名升序。 */
export function tencentSignature(path: string, params: Record<string, string>, sk: string): string {
  const raw = Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join('&');
  return createHash('md5').update(`${path}?${raw}${sk}`, 'utf8').digest('hex');
}

/** 拼最终请求地址：每个参数值单独 url 编码；有 SK 时附 sig。 */
export function tencentUrl(path: string, params: Record<string, string>, key: string, sk: string): string {
  const all: Record<string, string> = { ...params, key };
  const query = Object.keys(all).sort().map((name) => `${name}=${encodeURIComponent(all[name])}`);
  if (sk) query.push(`sig=${tencentSignature(path, all, sk)}`);
  return `${TENCENT_HOST}${path}?${query.join('&')}`;
}

// 347：查询无结果；110/111/112：来源、签名或 IP 未授权；120/121：频率或配额超限。
const NO_RESULT = new Set([347]);

async function request(path: string, params: Record<string, string>) {
  const { key, sk } = credentials();
  const response = await fetch(tencentUrl(path, params, key, sk), {
    signal: AbortSignal.timeout(8000),
    headers: { 'x-legacy-url-decode': 'no' },
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new TencentMapError('位置服务请求失败', 'upstream', 503);
  const payload = await response.json();
  const status = Number(payload?.status);
  if (status !== 0) {
    if (NO_RESULT.has(status)) throw new TencentMapError('未找到该地点', 'not_found', 404, status);
    // 上游 message 里可能带来源 IP，不原样透出。
    throw new TencentMapError('位置服务返回错误', 'upstream', 503, status);
  }
  return payload;
}

type LatLng = { lat?: unknown; lng?: unknown } | null | undefined;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** 腾讯返回 GCJ-02 的 {lat,lng}；转成与高德相同的 "lng,lat"（WGS84）字符串。 */
function storedLocation(location: LatLng): string | undefined {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const wgs = gcj02ToWgs84(lat, lng);
  return formatLngLat(wgs.lng, wgs.lat);
}

function gcjParam(lat: number, lng: number): string {
  const gcj = wgs84ToGcj02(lat, lng);
  return `${gcj.lat.toFixed(6)},${gcj.lng.toFixed(6)}`;
}

function place(row: unknown) {
  const item = asRecord(row);
  const ad = asRecord(item.ad_info);
  return {
    name: text(item.title),
    address: text(item.address),
    location: storedLocation(item.location as LatLng),
    distance: item._distance ?? item.distance,
    type: text(item.category),
    province: text(item.province) || text(ad.province),
    city: text(item.city) || text(ad.city),
    district: text(item.district) || text(ad.district),
    adcode: item.adcode ?? ad.adcode,
  };
}

export async function geocodeAddress(address: string) {
  const payload = await request('/ws/geocoder/v1', { address });
  const result = asRecord(payload.result);
  const parts = asRecord(result.address_components);
  const ad = asRecord(result.ad_info);
  const formatted = [parts.province, parts.city, parts.district, parts.street, parts.street_number]
    .map(text).filter((part, index, all) => part && all.indexOf(part) === index).join('') || text(result.title);
  const location = storedLocation(result.location as LatLng);
  if (!location) return [];
  return [{
    formatted_address: formatted,
    province: text(parts.province),
    city: text(parts.city),
    district: text(parts.district),
    adcode: ad.adcode,
    level: result.level,
    location,
  }];
}

export async function reverseGeocode(lat: number, lng: number) {
  const payload = await request('/ws/geocoder/v1', { location: gcjParam(lat, lng), get_poi: '1' });
  const result = asRecord(payload.result);
  if (!Object.keys(result).length) return null;
  const parts = asRecord(result.address_component);
  const ad = asRecord(result.ad_info);
  return {
    formatted_address: text(result.address),
    addressComponent: {
      province: text(parts.province),
      city: text(parts.city),
      district: text(parts.district),
      adcode: ad.adcode,
    },
    pois: Array.isArray(result.pois) ? result.pois.map(place) : [],
  };
}

export async function searchNearbyPOIs(lat: number, lng: number, keywords: string[], radius = 5000) {
  const center = gcjParam(lat, lng);
  const r = Math.min(Math.max(Math.round(radius), 1), 1000 * 50);
  // 腾讯地点搜索一次只收一个关键词；最多查前 3 个，控制调用量。
  const rows: ReturnType<typeof place>[] = [];
  for (const keyword of keywords.filter(Boolean).slice(0, 3)) {
    const payload = await request('/ws/place/v1/search', { keyword, boundary: `nearby(${center},${r},0)`, page_size: '20' });
    if (Array.isArray(payload.data)) rows.push(...payload.data.map(place));
  }
  return rows;
}

export async function getLocationSuggestions(query: string) {
  const payload = await request('/ws/place/v1/suggestion', { keyword: query });
  return (Array.isArray(payload.data) ? payload.data : []).map((row: unknown) => {
    const item = place(row);
    return { ...item, district: [item.province, item.city, item.district].filter((part, index, all) => part && all.indexOf(part) === index).join('') };
  });
}
