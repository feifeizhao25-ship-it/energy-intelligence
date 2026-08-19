/**
 * 🏰 护城河系统：开放平台中间件
 * 核心：API Key 鉴权、速率限制、调用日志记录
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function checkApiKey(req: NextRequest) {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) return { valid: false };

    const keyRecord = await prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: { user: true }
    });

    if (!keyRecord || keyRecord.status !== 'ACTIVE') {
        return { valid: false };
    }

    // 更新最后使用时间
    await prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() }
    });

    return { valid: true, userId: keyRecord.userId, keyId: keyRecord.id };
}

export async function logApiCall(params: {
    userId: string;
    apiKeyId?: string;
    endpoint: string;
    method: string;
    input: any;
    output: any;
    duration: number;
    status: number;
}) {
    return prisma.apiLog.create({
        data: params
    });
}
