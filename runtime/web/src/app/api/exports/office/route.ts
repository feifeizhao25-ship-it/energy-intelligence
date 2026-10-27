import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { consumeQuota } from '@/lib/audit/quota';
import { prisma } from '@/lib/prisma';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { EXPORT_FORMATS } from '@/lib/membership/plans';
import { slidesBuffer, workbookBuffer } from '@/lib/reports/ooxml-zip';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录后再导出报告' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const format = body?.format;
    const label = format === 'xlsx' ? 'Excel' : format === 'pptx' ? 'PPT' : '';
    if (!label) return NextResponse.json({ error: 'UNSUPPORTED_FORMAT', message: '请选择 Excel 或 PPT' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
    const plan = effectivePlan(user?.plan, user?.planExpireAt) as keyof typeof EXPORT_FORMATS;
    const allowed = (EXPORT_FORMATS[plan] ?? []) as readonly string[];
    if (!allowed.includes(label)) {
        return NextResponse.json({ error: 'FORMAT_NOT_INCLUDED', message: `当前套餐不含 ${label} 导出` }, { status: 403 });
    }
    const quota = await consumeQuota(session.user.id, 'EXPORTS');
    if (!quota.success) {
        return NextResponse.json({ error: 'EXPORT_QUOTA_EXCEEDED', message: '本月报告导出额度已用尽' }, { status: quota.usage.exceeded ? 429 : 503 });
    }
    const rows = Array.isArray(body.rows) ? body.rows.filter((row: unknown) => Array.isArray(row)).map((row: unknown[]) => row.map((cell) => String(cell ?? ''))) : [];
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '新能源智库';
    const table = [['新能源智库', title], ...rows];
    const file = format === 'xlsx' ? workbookBuffer(table) : slidesBuffer('新能源智库', [title, ...rows.map((row: string[]) => row.join(' '))]);
    const filename = format === 'xlsx' ? 'nengjian.xlsx' : 'nengjian.pptx';
    const type = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return new NextResponse(new Uint8Array(file), {
        headers: {
            'Content-Type': type,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'private, no-store',
        },
    });
}
