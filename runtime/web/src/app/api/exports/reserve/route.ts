import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { consumeQuota } from '@/lib/audit/quota';
import { prisma } from '@/lib/prisma';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { EXPORT_FORMATS } from '@/lib/membership/plans';

/**
 * Reserve one server-accounted export before a browser-side renderer starts.
 * The generated PDF / Word file never becomes available when authentication, persistence,
 * format permission, or quota enforcement fails.
 *
 * 请求体（可选）：{ format: 'pdf' | 'docx' }，缺省为 pdf（兼容旧调用）。
 * Word 导出只对套餐权益里含 Word 的档位开放（lib/membership/plans.ts EXPORT_FORMATS），先核验格式再扣额度。
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录后再导出报告' }, { status: 401 });
    }

    // Only an absent body/format defaults to PDF; malformed requests must not consume quota.
    const raw = await req.text();
    let body;
    try { body = raw.trim() ? JSON.parse(raw) : {}; } catch {
        return NextResponse.json({ error: 'INVALID_REQUEST', message: '导出请求格式无效，请重试' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ error: 'INVALID_REQUEST', message: '导出请求格式无效，请重试' }, { status: 400 });
    }
    const format = body.format === undefined ? 'pdf' : body.format;
    if (format !== 'pdf' && format !== 'docx') {
        return NextResponse.json({ error: 'UNSUPPORTED_FORMAT', message: '报告导出格式仅支持 PDF 或 Word' }, { status: 400 });
    }
    if (format === 'docx') {
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
        const plan = effectivePlan(user?.plan, user?.planExpireAt) as keyof typeof EXPORT_FORMATS;
        const allowed = (EXPORT_FORMATS[plan] ?? []) as readonly string[];
        if (!allowed.includes('Word')) {
            return NextResponse.json({ error: 'FORMAT_NOT_INCLUDED', message: '当前套餐不含 Word 导出，可导出 PDF，或升级到专业版及以上' }, { status: 403 });
        }
    }

    const result = await consumeQuota(session.user.id, 'EXPORTS');
    if (!result.success) {
        return NextResponse.json({
            error: 'EXPORT_QUOTA_EXCEEDED',
            message: result.usage.exceeded ? '今日报告导出额度已用尽，请升级套餐或明日再试' : '导出额度暂时无法核验，请稍后重试',
            usage: result.usage,
        }, { status: result.usage.exceeded ? 429 : 503 });
    }

    return NextResponse.json({ success: true, format, usage: result.usage });
}
