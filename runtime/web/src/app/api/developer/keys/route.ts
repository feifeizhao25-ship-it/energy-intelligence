import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function hashKey(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

const allowedPermissions = new Set(['read:projects', 'read:monitoring', 'read:analytics', 'read:papers', 'openclaw:execute']);

async function currentUserId() {
    const session = await getServerSession(authOptions);
    return session?.user?.id;
}

export async function GET() {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const records = await prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true, name: true, keyPrefix: true, permissions: true,
            status: true, createdAt: true, lastUsedAt: true, expiresAt: true,
        },
    });
    const counts = await prisma.apiLog.groupBy({ by: ['apiKeyId'], where: { userId, apiKeyId: { not: null } }, _count: { _all: true } });
    const countByKey = new Map(counts.map(item => [item.apiKeyId, item._count._all]));
    const keys = records.map(record => ({
        id: record.id,
        name: record.name || '未命名密钥',
        keyPreview: record.keyPrefix,
        permissions: Array.isArray(record.permissions) ? record.permissions : [],
        rateLimit: 60,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
        status: record.status.toLowerCase(),
        usageCount: countByKey.get(record.id) || 0,
    }));
    return NextResponse.json({ success: true, data: { keys, total: keys.length, limits: { maxKeys: 5 } } });
}

export async function POST(req: NextRequest) {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { name, permissions, expiresInDays } = await req.json();
    if (!name || String(name).trim().length > 80) {
        return NextResponse.json({ error: 'API Key name is required and must be at most 80 characters' }, { status: 400 });
    }
    if (await prisma.apiKey.count({ where: { userId, status: 'ACTIVE' } }) >= 5) {
        return NextResponse.json({ error: 'Maximum API keys limit reached' }, { status: 409 });
    }
    const selectedPermissions = Array.isArray(permissions)
        ? [...new Set(permissions.filter((value: unknown): value is string => typeof value === 'string' && allowedPermissions.has(value)))]
        : [];
    if (Array.isArray(permissions) && selectedPermissions.length !== permissions.length) {
        return NextResponse.json({ error: 'One or more API permissions are invalid' }, { status: 400 });
    }
    const rawKey = `xny_${crypto.randomBytes(32).toString('base64url')}`;
    const apiKey = await prisma.apiKey.create({
        data: {
            userId,
            name: String(name).trim(),
            keyHash: hashKey(rawKey),
            keyPrefix: `${rawKey.slice(0, 12)}…`,
            permissions: selectedPermissions.length ? selectedPermissions : ['read:projects'],
            expiresAt: expiresInDays
                ? new Date(Date.now() + Math.min(Number(expiresInDays), 365) * 86_400_000)
                : null,
        },
    });
    return NextResponse.json({
        success: true,
        data: { id: apiKey.id, key: rawKey, keyPrefix: apiKey.keyPrefix, createdAt: apiKey.createdAt },
        message: '请立即安全保存此密钥；完整密钥不会再次显示。',
    }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'API Key ID is required' }, { status: 400 });
    const result = await prisma.apiKey.updateMany({
        where: { id, userId, status: 'ACTIVE' },
        data: { status: 'REVOKED' },
    });
    if (!result.count) return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}
