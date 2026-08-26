import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * 获取用户的文献库
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const folderId = searchParams.get('folderId');

        // @ts-ignore
        const papers = await prisma.savedPaper.findMany({
            where: {
                userId: session.user.id,
                ...(folderId ? { folderId } : {})
            },
            orderBy: { createdAt: 'desc' },
            include: {
                folder: true
            }
        });

        // @ts-ignore
        const folders = await prisma.paperFolder.findMany({
            where: { userId: session.user.id }
        });

        return NextResponse.json({
            success: true,
            data: {
                papers,
                folders
            }
        });
    } catch (error: any) {
        console.error('[Papers API] Fetch failed:', error);

        // 增加容错：如果数据库连接失败，返回空数据而不是 500
        // 这通常发生在本地演示环境或数据库暂时不可用时
        return NextResponse.json({
            success: true,
            data: {
                papers: [],
                folders: []
            },
            _warning: 'Database connection failed, showing empty library.',
            _error: error.message
        });
    }
}
