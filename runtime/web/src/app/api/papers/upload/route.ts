import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ragProcessor } from '@/lib/papers/rag';
import { validatePdfBuffer, PdfValidationError } from '@/lib/papers/pdf-guard';
import { prisma } from '@/lib/prisma';
import { uploadToOSS } from '@/lib/oss/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * 上传并索引本地 PDF
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: '没有上传文件' }, { status: 400 });
        }

        const title = (formData.get('title') as string) || file.name;
        const buffer = Buffer.from(await file.arrayBuffer());

        // 安全校验：MIME 类型 + 25MB 大小限制 + %PDF- 魔数（客户端 MIME 可伪造，必须核对文件头）
        const rejection = validatePdfBuffer(buffer, file.type || undefined);
        if (rejection) {
            return NextResponse.json({ error: rejection.error }, { status: rejection.status });
        }

        // 1. 上传到 OSS (可选，用于持久化)
        const ossPath = `users/${session.user.id}/papers/${uuidv4()}-${file.name}`;
        const ossResult = await uploadToOSS(ossPath, buffer);

        // 2. 存入数据库
        const paperId = `local-${Date.now()}`;
        const savedPaper = await prisma.savedPaper.create({
            data: {
                userId: session.user.id,
                paperId: paperId,
                title: title,
                authors: [],
                pdfUrl: ossResult.url,
                source: 'upload'
            }
        });

        // 3. 后台索引 (RAG)
        // 异步执行索引比较好，但这里为了演示直接等待
        const indexResult = await ragProcessor.indexPdf(buffer, paperId, {
            title,
            userId: session.user.id,
            source: 'upload',
            sourceUrl: ossResult.url,
            retrievedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            data: {
                id: savedPaper.id,
                paperId: paperId,
                title: title,
                pdfUrl: ossResult.url,
                chunks: indexResult.chunks
            }
        });

    } catch (error: any) {
        console.error('[Upload API] Failed:', error);
        if (error instanceof PdfValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        // 解析失败等已知客户端错误返回 422，不向客户端泄露内部异常细节；
        // 其余（OSS/数据库等）按服务端错误处理。
        if (typeof error?.message === 'string' && error.message.startsWith('PDF ')) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        return NextResponse.json({ error: '上传失败' }, { status: 500 });
    }
}
