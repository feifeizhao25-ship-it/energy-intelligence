import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { consumeQuota } from '@/lib/audit/quota';

/**
 * Reserve one server-accounted export before a browser-side renderer starts.
 * The generated PDF never becomes available when authentication, persistence,
 * or quota enforcement fails.
 */
export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录后再导出报告' }, { status: 401 });
    }

    const result = await consumeQuota(session.user.id, 'EXPORTS');
    if (!result.success) {
        return NextResponse.json({
            error: 'EXPORT_QUOTA_EXCEEDED',
            message: result.usage.exceeded ? '今日报告导出额度已用尽，请升级套餐或明日再试' : '导出额度暂时无法核验，请稍后重试',
            usage: result.usage,
        }, { status: result.usage.exceeded ? 429 : 503 });
    }

    return NextResponse.json({ success: true, usage: result.usage });
}
