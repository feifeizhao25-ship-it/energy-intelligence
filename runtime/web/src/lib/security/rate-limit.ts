import { LRUCache } from 'lru-cache';
import { NextResponse } from 'next/server';

const tokenCache = new LRUCache<string, number>({
    max: 500,
    ttl: 60 * 1000, // 1 minute
});

/**
 * 极简 API 限流器
 * 用于保护短信发送、AI 调用等高成本接口
 * @param key 标识符 (如 IP 或 用户ID)
 * @param limit 每分钟允许的请求数
 */
export function rateLimit(key: string, limit: number = 5) {
    const currentUsage = tokenCache.get(key) || 0;

    if (currentUsage >= limit) {
        return {
            isLimited: true,
            remaining: 0,
        };
    }

    tokenCache.set(key, currentUsage + 1);

    return {
        isLimited: false,
        remaining: limit - (currentUsage + 1),
    };
}

/**
 * 通用的限流响应
 */
export function getRateLimitResponse() {
    return NextResponse.json(
        { error: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试' },
        { status: 429 }
    );
}
