import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { eraseUser, FileCleanupError, TeamHasMembersError } from '@/lib/account/erasure';
import { verifySmsCode } from '@/lib/auth/sms-verify';
import { prismaCodeStore } from '@/lib/auth/sms-store';
import { safeErrorMessage } from '@/lib/api/safe-error';
import { deleteUserFiles } from '@/lib/oss/client';

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

    let result;
    try {
        // 对象存储里的文件（上传的文献 PDF 等）在删除数据库内容之前先删：失败就整体中止、账号原样保留，可稍后重试；
        // 反过来先删库再删文件，一旦文件删除失败就再也没有人能找到这些文件了。团队前置检查在它之前，
        // 所以「团队里还有成员」被拒绝时，文件不会被动。
        result = await eraseUser(prisma as never, userId, { beforeErase: async () => { await deleteUserFiles(userId); } });
    } catch (error) {
        // 团队所有者且团队里还有别人：什么都没动，请先转让团队或移除成员
        if (error instanceof TeamHasMembersError) {
            return NextResponse.json({ error: safeErrorMessage(error, '团队里还有其他成员，请先转让团队或移除成员，再注销账号'), code: 'TEAM_HAS_MEMBERS' }, { status: 409 });
        }
        if (error instanceof FileCleanupError) {
            console.error('account erasure: 删除对象存储文件失败', error.cause ?? error);
            return NextResponse.json({ error: safeErrorMessage(error, '文件存储暂时不可用，账号尚未注销，请稍后重试') }, { status: 503 });
        }
        throw error;
    }
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
