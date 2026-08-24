import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ragProcessor } from '@/lib/papers/rag';
import axios from 'axios';

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
        const allowedHosts = (process.env.RAG_PDF_ALLOWED_HOSTS || 'arxiv.org,export.arxiv.org')
            .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
        if (parsedUrl.protocol !== 'https:' || !allowedHosts.includes(parsedUrl.hostname.toLowerCase())) {
            return NextResponse.json({ error: 'PDF 来源域名未获准' }, { status: 400 });
        }

        console.log(`[RAG] Starting indexing for paper: ${paperId}, URL: ${pdfUrl}`);

        // 1. 下载 PDF
        const response = await axios.get(pdfUrl, {
            responseType: 'arraybuffer', timeout: 15000, maxContentLength: 25 * 1024 * 1024,
            // 禁止跟随重定向，避免获准域名将服务器引向内网地址。
            maxBodyLength: 25 * 1024 * 1024, maxRedirects: 0,
        });
        if (!String(response.headers['content-type'] || '').toLowerCase().includes('application/pdf')) {
            return NextResponse.json({ error: '远程内容不是 PDF' }, { status: 415 });
        }
        const buffer = Buffer.from(response.data);

        // 2. 索引 PDF
        const result = await ragProcessor.indexPdf(buffer, paperId, {
            title,
            userId: session.user.id,
            source: 'external',
            sourceUrl: pdfUrl,
            retrievedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: '索引完成',
            chunks: result.chunks
        });
    } catch (error: any) {
        console.error('[RAG API] Indexing failed:', error);
        return NextResponse.json({
            error: error.message || '索引失败'
        }, { status: 500 });
    }
}
