import { NextRequest, NextResponse } from 'next/server';
import { getFromExportCache } from '@/lib/exports/cache';

/**
 * 专用下载接口
 * 根据文件名从缓存中导出的文件并提供下载
 */
export async function GET(req: NextRequest, props: { params: Promise<{ filename: string }> }) {
    const params = await props.params;
    const { filename } = params;

    if (!filename) {
        return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }

    const cached = getFromExportCache(filename);

    if (!cached) {
        return NextResponse.json({
            error: 'File not found or expired',
            message: '导出文件已过期，请重新导出'
        }, { status: 404 });
    }

    const { content, contentType } = cached;

    // 返回文件流
    return new Response(content as any, {
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    });
}
