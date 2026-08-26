import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ragProcessor } from '@/lib/papers/rag';
import { request as httpsRequest } from 'node:https';

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function downloadArxivPdf(pathname: string): Promise<Buffer> {
    const match = pathname.match(/^\/pdf\/([0-9]{4}\.[0-9]{4,5})(?:\.pdf)?$/);
    if (!match) throw new Error('Unsupported arXiv PDF path');
    const safePath = `/pdf/${match[1]}.pdf`;

    return new Promise((resolve, reject) => {
        const request = httpsRequest({
            hostname: 'export.arxiv.org',
            port: 443,
            method: 'GET',
            path: safePath,
            timeout: 15_000,
            headers: { Accept: 'application/pdf' },
        }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error('PDF provider rejected the request'));
                return;
            }
            if (!String(response.headers['content-type'] || '').toLowerCase().includes('application/pdf')) {
                response.resume();
                reject(new Error('Remote content is not a PDF'));
                return;
            }
            const chunks: Buffer[] = [];
            let total = 0;
            response.on('data', chunk => {
                total += chunk.length;
                if (total > MAX_PDF_BYTES) {
                    request.destroy(new Error('PDF exceeds size limit'));
                    return;
                }
                chunks.push(Buffer.from(chunk));
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
        });
        request.on('timeout', () => request.destroy(new Error('PDF download timed out')));
        request.on('error', reject);
        request.end();
    });
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
        const allowedHosts = new Set(['arxiv.org', 'export.arxiv.org']);
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
