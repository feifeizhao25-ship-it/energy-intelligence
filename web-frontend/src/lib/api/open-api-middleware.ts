import { NextRequest, NextResponse } from 'next/server';

/**
 * 开放 API 中间件工具
 * 提供认证、限流、日志等功能
 */

// API Keys 存储 (与 keys/route.ts 共享)
const apiKeysDb: Map<string, ApiKeyData> = new Map();

// Rate limiting storage
const rateLimitDb: Map<string, RateLimitEntry> = new Map();

interface ApiKeyData {
    id: string;
    key: string;
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

// 预置测试 API Key
if (!apiKeysDb.has('xny_pk_demo_1234567890abcdef')) {
    apiKeysDb.set('xny_pk_demo_1234567890abcdef', {
        id: 'key-demo-001',
        key: 'xny_pk_demo_1234567890abcdef',
        name: 'Demo API Key',
        userId: 'dev-master-id',
        permissions: ['read:projects', 'read:monitoring', 'read:papers', 'read:analytics'],
        rateLimit: 100,
        createdAt: new Date(),
        status: 'active',
        usageCount: 0
    });
}

/**
 * 验证 API Key
 */
export function validateApiKey(apiKey: string): {
    valid: boolean;
    data?: ApiKeyData;
    error?: string;
    errorCode?: string;
} {
    if (!apiKey) {
        return { valid: false, error: 'API key is required', errorCode: 'MISSING_API_KEY' };
    }

    if (!apiKey.startsWith('xny_pk_')) {
        return { valid: false, error: 'Invalid API key format', errorCode: 'INVALID_FORMAT' };
    }

    const keyData = apiKeysDb.get(apiKey);

    if (!keyData) {
        return { valid: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' };
    }

    if (keyData.status === 'revoked') {
        return { valid: false, error: 'API key has been revoked', errorCode: 'KEY_REVOKED' };
    }

    if (keyData.expiresAt && new Date() > keyData.expiresAt) {
        keyData.status = 'expired';
        return { valid: false, error: 'API key has expired', errorCode: 'KEY_EXPIRED' };
    }

    // 更新使用统计
    keyData.lastUsedAt = new Date();
    keyData.usageCount++;

    return { valid: true, data: keyData };
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
        const validation = validateApiKey(apiKey || '');
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
        const rateLimit = checkRateLimit(keyData.key, keyData.rateLimit);
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
            logApiCall(keyData.id, req.nextUrl.pathname, req.method, 200, latency);

            return response;

        } catch (error: any) {
            const latency = Date.now() - startTime;
            logApiCall(keyData.id, req.nextUrl.pathname, req.method, 500, latency);

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
