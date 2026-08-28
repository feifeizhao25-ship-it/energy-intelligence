import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: '知识图谱需要可核验的论文标识和引用关系数据，当前未返回模拟节点或连线。',
        code: 'VERIFIED_CITATION_GRAPH_UNAVAILABLE',
    }, { status: 503 });
}
