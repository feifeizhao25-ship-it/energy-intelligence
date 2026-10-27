import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ragProcessor } from '@/lib/papers/rag';
function downloadArxivPdf(pathname: string): Promise<Buffer> {
    void pathname;
    return Promise.reject(new Error('OVERSEAS_SOURCE_DISABLED'));
}

/**
 * 触发文献索引 (RAG)
 * 支持通过 PDF URL 索引
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    try {
        const { paperId, pdfUrl, title } = await req.json();

        if (!pdfUrl || !paperId || !title) {
            return NextResponse.json({ error: '缺失 PDF 链接' }, { status: 400 });
        }

        const parsedUrl = new URL(pdfUrl);
        // Fixed public origins only. An environment-controlled allowlist could be
        // misconfigured to include an internal host and would reintroduce SSRF.
        const allowedHosts = new Set<string>();
        if (
            parsedUrl.protocol !== 'https:' ||
            !allowedHosts.has(parsedUrl.hostname.toLowerCase()) ||
            (parsedUrl.port !== '' && parsedUrl.port !== '443') ||
            parsedUrl.username !== '' ||
            parsedUrl.password !== ''
        ) {
            return NextResponse.json({ error: 'PDF 来源域名未获准' }, { status: 400 });
        }

        console.log('[RAG] Starting indexing for an authenticated paper');

        // 1. 通过固定主机和严格 arXiv 标识下载 PDF；用户输入不能控制请求主机。
        const buffer = await downloadArxivPdf(parsedUrl.pathname);

        // 2. 索引 PDF
        const result = await ragProcessor.indexPdf(buffer, paperId, {
            title,
            userId: session.user.id,
            source: 'external',
            sourceUrl: parsedUrl.toString(),
            retrievedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: '索引完成',
            chunks: result.chunks
        });
    } catch {
        console.error('[RAG API] Indexing failed');
        return NextResponse.json({
            error: '索引失败'
        }, { status: 500 });
    }
}
