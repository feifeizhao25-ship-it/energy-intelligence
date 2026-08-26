import { LRUCache } from 'lru-cache';

// 配置缓存
const options = {
    max: 500, // 最大缓存条目
    ttl: 1000 * 60 * 60 * 24, // 默认过期时间 24小时 (气象数据更新频率一般是每日)
    allowStale: false,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
};

const cache = new LRUCache<string, any>(options);

/**
 * 包装异步函数，自动进行缓存
 * @param keyPrefix 缓存键前缀
 * @param fn 要包装的异步函数
 * @param ttl 自定义过期时间（可选）
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
    keyPrefix: string,
    fn: T,
    ttl?: number
): T {
    return (async (...args: any[]) => {
        const key = `${keyPrefix}:${JSON.stringify(args)}`;
        const cached = cache.get(key);

        if (cached !== undefined) {
            console.log(`[Cache Hit] ${key}`);
            return cached;
        }

        const result = await fn(...args);
        cache.set(key, result, { ttl });
        return result;
    }) as T;
}

export default cache;
