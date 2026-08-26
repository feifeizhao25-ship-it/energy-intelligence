import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: 'VERIFIED_TELEMETRY_REQUIRED',
        message: '性能分析需要已校验的监控数据，当前没有可用于分析的真实数据。',
    }, { status: 503 });
}
