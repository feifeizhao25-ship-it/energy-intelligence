import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { citationEdges, readLiteratureCache, type CorpusRecord } from '@/lib/papers/domestic-corpus';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const records = [...readLiteratureCache()];
    try {
        const { prisma } = await import('@/lib/prisma');
        const rows = await prisma.literatureRecord.findMany({ where: { OR: [{ userId: session.user.id }, { userId: null }] }, take: 500 });
        records.push(...rows.map((row) => ({
            source: row.source,
            externalId: row.externalId,
            title: row.title,
            doi: row.doi,
            year: row.year,
            licence: row.licence,
            citations: Array.isArray(row.citations) ? row.citations as CorpusRecord['citations'] : [],
        })));
    } catch {
        // 语料表尚未迁移时仍可使用文件缓存。
    }
    if (!records.length) {
        return NextResponse.json({
            success: false,
            error: '知识图谱需要已入库的论文标识。当前没有语料，未返回模拟节点或连线。',
            code: 'VERIFIED_CITATION_GRAPH_UNAVAILABLE',
        }, { status: 503 });
    }
    const graph = citationEdges(records);
    return NextResponse.json({
        success: true,
        data: {
            ...graph,
            notice: graph.edges.length
                ? '连线只来自语料中能够互相对上的 DOI 或标题。'
                : '语料中没有可核验的引用关系，未生成模拟连线。',
        },
    });
}
