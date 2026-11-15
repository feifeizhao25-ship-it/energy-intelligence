import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { tierOf } from '@/lib/entitlements/access';

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
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
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
    const account = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpireAt: true } });
    const tier = tierOf(account?.plan, account?.planExpireAt);
    const monthly = Number(tier?.quotas?.api_calls_per_month ?? 0);
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const used = await prisma.apiLog.count({ where: { userId, createdAt: { gte: monthStart } } });
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
    const note = monthly === 0
        ? '当前套餐不含分级接口。专业档 500 次/月，团队档 5,000 次/月，上限档按合同计量。'
        : monthly < 0
            ? `上限档接口按合同计量。本月已记录 ${used} 次。每分钟 60 次。`
            : `本月接口额度 ${used} / ${monthly}。每分钟 60 次。说明见 /developer/docs。`;
    return NextResponse.json({ success: true, data: { keys, total: keys.length, limits: { maxKeys: 5, rpm: 60, apiCallsPerMonth: monthly, usedThisMonth: used }, entitlement: { note } } });
}

export async function POST(req: NextRequest) {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const account = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planExpireAt: true } });
    const monthly = Number(tierOf(account?.plan, account?.planExpireAt)?.quotas?.api_calls_per_month ?? 0);
    if (monthly === 0) return NextResponse.json({ error: '当前套餐不含分级接口' }, { status: 403 });
    const { name, permissions, expiresInDays } = await req.json();
    if (!name || String(name).trim().length > 80) {
        return NextResponse.json({ error: '请填写 API 密钥名称，且不超过 80 个字符' }, { status: 400 });
    }
    if (await prisma.apiKey.count({ where: { userId, status: 'ACTIVE' } }) >= 5) {
        return NextResponse.json({ error: 'API 密钥数量已达上限' }, { status: 409 });
    }
    const selectedPermissions = Array.isArray(permissions)
        ? [...new Set(permissions.filter((value: unknown): value is string => typeof value === 'string' && allowedPermissions.has(value)))]
        : [];
    if (Array.isArray(permissions) && selectedPermissions.length !== permissions.length) {
        return NextResponse.json({ error: '存在无效的 API 权限项' }, { status: 400 });
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
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: '缺少 API 密钥 ID' }, { status: 400 });
    const result = await prisma.apiKey.updateMany({
        where: { id, userId, status: 'ACTIVE' },
        data: { status: 'REVOKED' },
    });
    if (!result.count) return NextResponse.json({ error: '未找到该 API 密钥' }, { status: 404 });
    return NextResponse.json({ success: true });
}
