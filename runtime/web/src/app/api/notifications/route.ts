import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

async function requireUser() {
    const session = await getServerSession(authOptions);
    return session?.user?.id || null;
}

export async function GET() {
    if (!await requireUser()) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.json({
        success: true,
        data: { notifications: [], stats: { total: 0, unread: 0 }, hasMore: false },
        message: '通知持久化服务尚未接入，未返回虚构告警或示例通知',
    });
}

async function unavailable() {
    if (!await requireUser()) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: 'NOTIFICATION_STORAGE_UNAVAILABLE',
        message: '通知持久化服务尚未接入，操作未被伪装为成功',
    }, { status: 503 });
}

export const POST = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
