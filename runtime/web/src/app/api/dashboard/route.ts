import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: '个人活动聚合服务尚未接入真实审计日志，未返回示例项目、成就、通知或使用趋势。',
        code: 'DASHBOARD_AGGREGATION_UNAVAILABLE',
    }, { status: 503 });
}
