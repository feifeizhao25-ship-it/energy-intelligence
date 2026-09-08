import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getFromExportCache } from '@/lib/exports/cache';

export async function GET(req: NextRequest, props: { params: Promise<{ filename: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    const { filename } = await props.params;
    const cached = getFromExportCache(filename, session.user.id);
    if (!cached) {
        return NextResponse.json({ error: 'EXPORT_NOT_FOUND', message: '导出文件不存在或已过期，请重新导出' }, { status: 404 });
    }
    return new Response(cached.content as any, {
        headers: {
            'Content-Type': cached.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
