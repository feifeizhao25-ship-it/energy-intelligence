/**
 * 服务端位置服务的提供方开关。国内版默认腾讯位置服务。
 * LOCATION_PROVIDER=amap（或 gaode / 高德）切回高德。两边返回的字段相同。
 */
import * as amap from './amap';
import * as tencent from './tencent-map';

export type LocationProviderName = 'amap' | 'tencent';

export function locationProvider(env: NodeJS.ProcessEnv = process.env): LocationProviderName {
  const raw = (env.LOCATION_PROVIDER || '').trim().toLowerCase();
  if (raw === 'amap' || raw === 'gaode' || raw === '高德') return 'amap';
  return 'tencent';
}

function impl() {
  return locationProvider() === 'tencent' ? tencent : amap;
}

export const geocodeAddress = (address: string) => impl().geocodeAddress(address);
export const reverseGeocode = (lat: number, lng: number) => impl().reverseGeocode(lat, lng);
export const searchNearbyPOIs = (lat: number, lng: number, keywords: string[], radius?: number) =>
  impl().searchNearbyPOIs(lat, lng, keywords, radius);
export const getLocationSuggestions = (query: string) => impl().getLocationSuggestions(query);

/** 两家的错误类都带 code 与 httpStatus。 */
export function isLocationProviderError(error: unknown): error is Error & { code: string; httpStatus: number } {
  return error instanceof Error && (error.name === 'AmapError' || error.name === 'TencentMapError')
    && typeof (error as { httpStatus?: unknown }).httpStatus === 'number';
}
