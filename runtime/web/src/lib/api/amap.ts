const AMAP_API = 'https://restapi.amap.com/v3';

function apiKey(): string {
  const key = process.env.AMAP_WEB_SERVICE_KEY || process.env.NEXT_PUBLIC_AMAP_KEY;
  if (!key) throw new Error('位置服务未配置');
  return key;
}

async function request(path: string, parameters: Record<string, string>) {
  const query = new URLSearchParams({ ...parameters, key: apiKey(), output: 'JSON' });
  const response = await fetch(`${AMAP_API}/${path}?${query}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`位置服务请求失败（${response.status}）`);
  const payload = await response.json();
  if (payload.status !== '1') throw new Error(payload.info || '位置服务返回错误');
  return payload;
}

export async function geocodeAddress(address: string) {
  const payload = await request('geocode/geo', { address });
  return payload.geocodes ?? [];
}

export async function reverseGeocode(lat: number, lng: number) {
  const payload = await request('geocode/regeo', { location: `${lng},${lat}`, extensions: 'all' });
  return payload.regeocode ?? null;
}

export async function searchNearbyPOIs(
  lat: number,
  lng: number,
  keywords: string[],
  radius = 5000,
) {
  const payload = await request('place/around', {
    location: `${lng},${lat}`,
    keywords: keywords.join('|'),
    radius: String(Math.min(Math.max(radius, 0), 50000)),
  });
  return payload.pois ?? [];
}

export async function getLocationSuggestions(query: string) {
  const payload = await request('assistant/inputtips', { keywords: query });
  return payload.tips ?? [];
}
