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
 * 浏览器里的地图组件要用的是另一种 Key（高德 JS API Key，按域名白名单
 * 限制），那条路可以继续用 `NEXT_PUBLIC_AMAP_JS_KEY` 之类的名字，
 * 但**不要和这一个共用同一个 Key**。
 */
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
