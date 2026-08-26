import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * 保存文献到用户的个人库
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    try {
        const { paper } = await req.json();

        if (!paper || !paper.id || !paper.title) {
            return NextResponse.json({ error: '无效的文献数据' }, { status: 400 });
        }

        // 使用 upsert 确保不会重复保存，并更新最新信息
        // 注意：userId_paperId 需要在 schema.prisma 中定义了 @@unique([userId, paperId])
        const savedPaper = await prisma.savedPaper.upsert({
            where: {
                userId_paperId: {
                    userId: session.user.id,
                    paperId: paper.id
                }
            },
            update: {
                title: paper.title,
                authors: paper.authors,
                year: paper.year || null,
                journal: paper.venue || paper.journal || null,
                abstract: paper.abstract || null,
                pdfUrl: paper.pdfUrl || null,
                citationCount: paper.citationCount || 0,
                updatedAt: new Date()
            },
            create: {
                userId: session.user.id,
                paperId: paper.id,
                title: paper.title,
                authors: paper.authors,
                year: paper.year || null,
                journal: paper.venue || paper.journal || null,
                abstract: paper.abstract || null,
                pdfUrl: paper.pdfUrl || null,
                citationCount: paper.citationCount || 0,
                source: paper.source || 'external',
                status: 'idle'
            }
        });

        return NextResponse.json({
            success: true,
            data: savedPaper
        });
    } catch (error: any) {
        console.error('[Save Paper API] Error:', error);
        return NextResponse.json({
            error: error.message || '保存文献失败'
        }, { status: 500 });
    }
}
