import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { eraseUser } from '@/lib/account/erasure';
import { verifySmsCode } from '@/lib/auth/sms-verify';
import { prismaCodeStore } from '@/lib/auth/sms-store';

/**
 * 注销账号。需要本人手机号的新验证码（防止会话被他人拿到后直接注销），并输入「确认注销」。
 * 个人数据删除、账号匿名化；付款记录作为财务凭证保留并在返回里列出。
 */
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== '确认注销') {
        return NextResponse.json({ error: '请输入「确认注销」' }, { status: 400 });
    }
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { phone: true } });
    if (!user?.phone) return NextResponse.json({ error: '账号不存在或已注销' }, { status: 404 });
    const check = await verifySmsCode(prismaCodeStore, user.phone, String(body?.code ?? ''));
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

    const result = await eraseUser(prisma as never, userId);
    if (result.failed.length) {
        console.error('account erasure incomplete', result.failed);
        return NextResponse.json({ error: '部分数据未能删除，请联系客服处理', failed: result.failed }, { status: 500 });
    }
    return NextResponse.json({
        success: true,
        deleted: result.deleted,
        retained: result.retained,
        message: '账号已注销。付款记录作为财务凭证依法保留，已与你的个人信息解除关联。',
    });
}
