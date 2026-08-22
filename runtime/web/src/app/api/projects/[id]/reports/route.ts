import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

async function unavailable() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: 'VERIFIED_TELEMETRY_REQUIRED',
        message: '运维报告需要经验证的 SCADA/IoT 数据，当前不会生成模拟报告。',
    }, { status: 503 });
}

export const GET = unavailable;
export const POST = unavailable;
