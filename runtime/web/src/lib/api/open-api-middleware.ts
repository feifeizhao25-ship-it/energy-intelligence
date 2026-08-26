import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * 开放 API 中间件工具
 * 提供认证、限流、日志等功能
 */

// Rate limiting storage
const rateLimitDb: Map<string, RateLimitEntry> = new Map();

interface ApiKeyData {
    id: string;
    keyHash: string;
    name: string;
    userId: string;
    permissions: string[];
    rateLimit: number;
    createdAt: Date;
    lastUsedAt?: Date;
    expiresAt?: Date;
    status: 'active' | 'revoked' | 'expired';
    usageCount: number;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// API 调用日志
const apiLogsDb: { timestamp: Date; keyId: string; endpoint: string; method: string; status: number; latency: number }[] = [];

/**
 * 验证 API Key
 */
export async function validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    data?: ApiKeyData;
    error?: string;
    errorCode?: string;
}> {
    if (!apiKey) {
        return { valid: false, error: 'API key is required', errorCode: 'MISSING_API_KEY' };
    }

    if (!apiKey.startsWith('xny_')) {
        return { valid: false, error: 'Invalid API key format', errorCode: 'INVALID_FORMAT' };
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const record = await prisma.apiKey.findUnique({ where: { keyHash } });

    if (!record) {
        return { valid: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' };
    }

    if (record.status === 'REVOKED') {
        return { valid: false, error: 'API key has been revoked', errorCode: 'KEY_REVOKED' };
    }

    if (record.status === 'EXPIRED' || (record.expiresAt && new Date() > record.expiresAt)) {
        if (record.status !== 'EXPIRED') await prisma.apiKey.update({ where: { id: record.id }, data: { status: 'EXPIRED' } });
        return { valid: false, error: 'API key has expired', errorCode: 'KEY_EXPIRED' };
    }

    await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    const permissions = Array.isArray(record.permissions) ? record.permissions.filter((value): value is string => typeof value === 'string') : [];
    return { valid: true, data: { id: record.id, keyHash, name: record.name || '', userId: record.userId, permissions, rateLimit: 60, createdAt: record.createdAt, lastUsedAt: record.lastUsedAt || undefined, expiresAt: record.expiresAt || undefined, status: 'active', usageCount: 0 } };
}

/**
 * 检查权限
 */
export function checkPermission(keyData: ApiKeyData, permission: string): boolean {
    if (keyData.permissions.includes('*')) return true;
    if (keyData.permissions.includes(permission)) return true;

    const [action] = permission.split(':');
    if (keyData.permissions.includes(`${action}:*`)) return true;

    return false;
}

/**
 * 检查速率限制
 */
export function checkRateLimit(apiKey: string, limit: number): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
} {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 分钟窗口

    let entry = rateLimitDb.get(apiKey);

    if (!entry || now > entry.resetAt) {
        // 新窗口或窗口已过期
        entry = { count: 0, resetAt: now + windowMs };
        rateLimitDb.set(apiKey, entry);
    }

    entry.count++;

    return {
        allowed: entry.count <= limit,
        remaining: Math.max(0, limit - entry.count),
        resetAt: entry.resetAt
    };
}

/**
 * 记录 API 调用
 */
export function logApiCall(keyId: string, endpoint: string, method: string, status: number, latency: number) {
    apiLogsDb.push({
        timestamp: new Date(),
        keyId,
        endpoint,
        method,
        status,
        latency
    });

    // 只保留最近 10000 条日志
    if (apiLogsDb.length > 10000) {
        apiLogsDb.shift();
    }
}

/**
 * 获取 API 调用统计
 */
export function getApiStats(keyId?: string) {
    const logs = keyId ? apiLogsDb.filter(l => l.keyId === keyId) : apiLogsDb;

    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recentLogs = logs.filter(l => l.timestamp.getTime() > last24h);

    return {
        total: logs.length,
        last24h: recentLogs.length,
        avgLatency: recentLogs.length > 0
            ? recentLogs.reduce((sum, l) => sum + l.latency, 0) / recentLogs.length
            : 0,
        successRate: recentLogs.length > 0
            ? (recentLogs.filter(l => l.status < 400).length / recentLogs.length * 100).toFixed(1)
            : '0',
        byEndpoint: Object.entries(
            recentLogs.reduce((acc, l) => {
                acc[l.endpoint] = (acc[l.endpoint] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        ).map(([endpoint, count]) => ({ endpoint, count }))
    };
}

/**
 * 开放 API 包装器 - 处理认证和限流
 */
export function withOpenApi(
    handler: (req: NextRequest, keyData: ApiKeyData) => Promise<NextResponse>,
    requiredPermission: string
) {
    return async (req: NextRequest): Promise<NextResponse> => {
        const startTime = Date.now();

        // 1. 从 Header 获取 API Key
        const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '');

        // 2. 验证 API Key
        let validation: Awaited<ReturnType<typeof validateApiKey>>;
        try {
            validation = await validateApiKey(apiKey || '');
        } catch (error) {
            console.error('Open API key store unavailable', error);
            return NextResponse.json({ success: false, error: { code: 'API_KEY_STORE_UNAVAILABLE', message: 'API authentication is temporarily unavailable' } }, { status: 503 });
        }
        if (!validation.valid) {
            return NextResponse.json({
                success: false,
                error: {
                    code: validation.errorCode,
                    message: validation.error
                }
            }, {
                status: 401,
                headers: {
                    'WWW-Authenticate': 'Bearer realm="Open API"'
                }
            });
        }

        const keyData = validation.data!;

        // 3. 检查权限
        if (!checkPermission(keyData, requiredPermission)) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: `Missing required permission: ${requiredPermission}`,
                    required: requiredPermission,
                    granted: keyData.permissions
                }
            }, { status: 403 });
        }

        // 4. 检查速率限制
        const rateLimit = checkRateLimit(keyData.keyHash, keyData.rateLimit);
        if (!rateLimit.allowed) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests',
                    retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
                }
            }, {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': keyData.rateLimit.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': rateLimit.resetAt.toString(),
                    'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString()
                }
            });
        }

        try {
            // 5. 执行处理程序
            const response = await handler(req, keyData);

            // 6. 添加标准响应头
            const latency = Date.now() - startTime;
            response.headers.set('X-RateLimit-Limit', keyData.rateLimit.toString());
            response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
            response.headers.set('X-RateLimit-Reset', rateLimit.resetAt.toString());
            response.headers.set('X-Request-Id', `req_${Date.now()}`);
            response.headers.set('X-Response-Time', `${latency}ms`);

            // 7. 记录调用
            await prisma.apiLog.create({ data: { userId: keyData.userId, apiKeyId: keyData.id, endpoint: req.nextUrl.pathname, method: req.method, duration: latency, status: response.status } });

            return response;

        } catch (error: any) {
            const latency = Date.now() - startTime;
            await prisma.apiLog.create({ data: { userId: keyData.userId, apiKeyId: keyData.id, endpoint: req.nextUrl.pathname, method: req.method, duration: latency, status: 500 } }).catch(() => undefined);

            return NextResponse.json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An internal error occurred'
                }
            }, { status: 500 });
        }
    };
}

/**
 * 创建标准化的 API 响应
 */
export function createApiResponse(data: any, meta?: any) {
    return NextResponse.json({
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta
        }
    });
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse(
    items: any[],
    page: number,
    pageSize: number,
    total: number
) {
    return NextResponse.json({
        success: true,
        data: items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
            hasMore: page * pageSize < total
        },
        meta: {
            timestamp: new Date().toISOString()
        }
    });
}
