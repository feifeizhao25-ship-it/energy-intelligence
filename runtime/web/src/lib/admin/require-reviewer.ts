import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { isPolicyReviewer } from './policy-reviewers';

/** 审核员才能用；非审核员一律 404，不暴露后台存在 */
export async function requireReviewer() {
    const session = await getServerSession(authOptions);
    const id = session?.user?.id;
    if (!id) return { ok: false as const, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, phone: true } });
    if (!user || !isPolicyReviewer(user)) return { ok: false as const, response: NextResponse.json({ error: '页面不存在' }, { status: 404 }) };
    return { ok: true as const, user };
}

