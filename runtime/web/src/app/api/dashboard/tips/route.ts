import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { DISMISSIBLE_TIPS } from '@/lib/dashboard/personal-summary';
import { TIP_DISMISSED_TYPE } from '@/lib/dashboard/tips';

/** POST /api/dashboard/tips { id }：工作台低优先级提示「不再提示」（30 天）。告警、额度、到期提醒不能关闭。 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await req.json().catch(() => null);
    const id = body?.id;
    if (typeof id !== 'string' || !(DISMISSIBLE_TIPS as readonly string[]).includes(id)) {
        return NextResponse.json({ error: '这条提示不能关闭' }, { status: 400 });
    }
    await prisma.usageLog.create({ data: { userId, type: TIP_DISMISSED_TYPE, count: 0, metadata: { tipId: id } } });
    return NextResponse.json({ success: true });
}
