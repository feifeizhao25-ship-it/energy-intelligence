import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { parsePreferences, validatePreferences, PREFERENCE_LOG_TYPES } from '@/lib/dashboard/personalization';
import { profileFromUsageMetadata } from '@/lib/dashboard/user-profile';
import { safeErrorMessage } from '@/lib/api/safe-error';

/**
 * 工作台个性化偏好（角色、所在省份、关注领域、是否开启个性化）。
 * 存在 usage_logs（type = PROFILE_PREFERENCES，metadata.preferences），取最新一条；不改数据库结构。
 * 注销账号时随 usage_logs 一并删除。
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const log = await prisma.usageLog.findFirst({
        where: { userId, type: { in: [...PREFERENCE_LOG_TYPES] } }, orderBy: { date: 'desc' }, select: { metadata: true },
    });
    const preferences = log ? parsePreferences(log.metadata) : parsePreferences(null);
    const profile = profileFromUsageMetadata(log?.metadata ?? null);
    return NextResponse.json({ success: true, preferences, profile });
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    let preferences;
    let profile;
    try {
        const body = await req.json().catch(() => null);
        preferences = validatePreferences(body);
        profile = profileFromUsageMetadata(body);
    } catch (e) {
        return NextResponse.json({ error: safeErrorMessage(e, '偏好设置无效') }, { status: 400 });
    }
    await prisma.usageLog.create({
        data: { userId, type: 'PROFILE_PREFERENCES', count: 0, metadata: JSON.parse(JSON.stringify({ preferences, profile })) },
    });
    return NextResponse.json({ success: true, preferences, profile });
}
