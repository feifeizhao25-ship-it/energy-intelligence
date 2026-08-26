import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: 'TELEMETRY_NOT_CONNECTED',
        message: '该项目尚未连接经验证的 SCADA/IoT 数据源，系统不会生成模拟监控数据。',
    }, { status: 503 });
}
