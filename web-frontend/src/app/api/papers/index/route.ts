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

        if (!pdfUrl) {
            return NextResponse.json({ error: '缺失 PDF 链接' }, { status: 400 });
        }

        console.log(`[RAG] Starting indexing for paper: ${paperId}, URL: ${pdfUrl}`);

        // 1. 下载 PDF
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        // 2. 索引 PDF
        const result = await ragProcessor.indexPdf(buffer, paperId, {
            title,
            userId: session.user.id,
            source: 'external'
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
