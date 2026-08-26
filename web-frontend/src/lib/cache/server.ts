// 简单的内存缓存（生产环境建议使用Redis）
const cache = new Map<string, { data: any; expiresAt: number }>();

// 缓存配置
const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24小时

export function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }

  return item.data as T;
}

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
}

export function deleteCache(key: string): void {
  cache.delete(key);
}

export function clearCache(): void {
  cache.clear();
}

// 缓存装饰器
export function cached(ttl: number = DEFAULT_TTL) {
  return function <T extends (...args: any[]) => any>(
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (this: any, ...args: Parameters<T>) {
      const key = `${_propertyKey}:${JSON.stringify(args)}`;
      const cached = getCache<ReturnType<T>>(key);
      if (cached) return cached;

      if (!originalMethod) return undefined as any;

      const result = originalMethod.apply(this, args);
      if (result instanceof Promise) {
        result.then((data) => setCache(key, data, ttl));
      } else {
        setCache(key, result, ttl);
      }
      return result;
    } as T;
  };
}

// NASA POWER API 缓存键
export function getNasaCacheKey(lat: number, lng: number, startYear: number, endYear: number) {
  return `nasa:${lat}:${lng}:${startYear}:${endYear}`;
}

// Open-Meteo 缓存键
export function getOpenMeteoCacheKey(lat: number, lng: number) {
  return `openmeteo:${lat}:${lng}`;
}

// 清理过期缓存
export function cleanupCache(): void {
  const now = Date.now();
  for (const [key, item] of cache.entries()) {
    if (now > item.expiresAt) {
      cache.delete(key);
    }
  }
}

// 启动定时清理
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 60 * 60 * 1000); // 每小时清理一次
}
