import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { recordFeedback } from '@/lib/feedback/samples';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const kind = body?.kind;
    const rating = Number(body?.rating);
    if (kind !== 'thumbs_down' && kind !== 'low_rating') {
        return NextResponse.json({ error: '不支持的反馈类型' }, { status: 400 });
    }
    if (kind === 'low_rating' && !(rating > 0 && rating <= 2)) {
        return NextResponse.json({ error: '低分反馈请给出 1 或 2 分' }, { status: 400 });
    }
    await recordFeedback(kind, String(body?.text || ''));
    return NextResponse.json({ success: true });
}
