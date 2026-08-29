import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

async function unavailable() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    return NextResponse.json({
        success: false,
        error: 'VERIFIED_DEVICE_CONTROL_REQUIRED',
        message: '尚未接入经授权的设备控制与操作审计系统，当前不会模拟执行重启、告警处理或维护排期。',
    }, { status: 503 });
}

export const GET = unavailable;
export const POST = unavailable;
