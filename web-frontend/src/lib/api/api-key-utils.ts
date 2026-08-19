// API Key 验证工具函数
// 从 route.ts 分离出来,避免 Next.js 路由导出限制

interface ApiKey {
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

// 共享的 API Keys 存储
export const apiKeysDb: Map<string, ApiKey> = new Map();

// 预置一个测试 API Key
const demoKey: ApiKey = {
    id: 'key-demo-001',
    key: 'xny_pk_demo_1234567890abcdef',
    name: 'Demo API Key',
    userId: 'dev-master-id',
    permissions: ['read:projects', 'read:monitoring', 'read:papers'],
    rateLimit: 100,
    createdAt: new Date(),
    status: 'active',
    usageCount: 0
};
apiKeysDb.set(demoKey.key, demoKey);

// 验证 API Key
export function validateApiKey(key: string): { valid: boolean; apiKey?: ApiKey; error?: string } {
    const apiKey = apiKeysDb.get(key);

    if (!apiKey) {
        return { valid: false, error: 'Invalid API key' };
    }

    if (apiKey.status === 'revoked') {
        return { valid: false, error: 'API key has been revoked' };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        apiKey.status = 'expired';
        return { valid: false, error: 'API key has expired' };
    }

    // 更新使用统计
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount++;

    return { valid: true, apiKey };
}

// 权限检查函数
export function checkPermission(apiKey: ApiKey, requiredPermission: string): boolean {
    // 检查是否有通配符权限
    if (apiKey.permissions.includes('*')) return true;

    // 检查具体权限
    if (apiKey.permissions.includes(requiredPermission)) return true;

    // 检查类别权限 (如 read:* 匹配 read:projects)
    const [action] = requiredPermission.split(':');
    if (apiKey.permissions.includes(`${action}:*`)) return true;

    return false;
}

export type { ApiKey };
