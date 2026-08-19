import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import crypto from 'crypto';
import { apiKeysDb, type ApiKey } from '@/lib/api/api-key-utils';

/**
 * API 密钥管理
 * 用于生成和管理开放 API 的访问密钥
 */

// 生成 API Key
function generateApiKey(): string {
    const prefix = 'xny_pk_'; // xinnengyuan public key
    const randomPart = crypto.randomBytes(24).toString('hex');
    return `${prefix}${randomPart}`;
}

// GET - 获取用户的 API Keys 列表
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const userKeys = Array.from(apiKeysDb.values())
        .filter(k => k.userId === userId)
        .map(k => ({
            id: k.id,
            name: k.name,
            keyPreview: k.key.substring(0, 12) + '...' + k.key.slice(-4),
            permissions: k.permissions,
            rateLimit: k.rateLimit,
            createdAt: k.createdAt,
            lastUsedAt: k.lastUsedAt,
            expiresAt: k.expiresAt,
            status: k.status,
            usageCount: k.usageCount
        }));

    return NextResponse.json({
        success: true,
        data: {
            keys: userKeys,
            total: userKeys.length,
            limits: {
                maxKeys: 5,
                defaultRateLimit: 60
            }
        }
    });
}

// POST - 创建新的 API Key
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const body = await req.json();
    const { name, permissions, rateLimit = 60, expiresInDays } = body;

    if (!name) {
        return NextResponse.json({
            success: false,
            error: 'API Key name is required'
        }, { status: 400 });
    }

    // 检查用户是否超过 API Key 数量限制
    const userKeyCount = Array.from(apiKeysDb.values()).filter(k => k.userId === userId).length;
    if (userKeyCount >= 5) {
        return NextResponse.json({
            success: false,
            error: 'Maximum API keys limit reached (5)'
        }, { status: 400 });
    }

    const apiKey = generateApiKey();
    const newKey: ApiKey = {
        id: `key-${Date.now()}`,
        key: apiKey,
        name,
        userId,
        permissions: permissions || ['read:projects', 'read:monitoring'],
        rateLimit: Math.min(rateLimit, 1000), // 最大 1000/min
        createdAt: new Date(),
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined,
        status: 'active',
        usageCount: 0
    };

    apiKeysDb.set(apiKey, newKey);

    return NextResponse.json({
        success: true,
        data: {
            id: newKey.id,
            key: apiKey, // 只在创建时返回完整 key
            name: newKey.name,
            permissions: newKey.permissions,
            rateLimit: newKey.rateLimit,
            createdAt: newKey.createdAt,
            expiresAt: newKey.expiresAt,
            message: '请妥善保存此 API Key，它只会显示一次！'
        }
    });
}

// DELETE - 撤销 API Key
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'dev-master-id';

    const url = new URL(req.url);
    const keyId = url.searchParams.get('id');

    if (!keyId) {
        return NextResponse.json({
            success: false,
            error: 'API Key ID is required'
        }, { status: 400 });
    }

    // 找到并撤销 key
    for (const [key, apiKey] of apiKeysDb.entries()) {
        if (apiKey.id === keyId && apiKey.userId === userId) {
            apiKey.status = 'revoked';
            return NextResponse.json({
                success: true,
                data: {
                    id: keyId,
                    status: 'revoked',
                    message: 'API Key 已撤销'
                }
            });
        }
    }

    return NextResponse.json({
        success: false,
        error: 'API Key not found'
    }, { status: 404 });
}

