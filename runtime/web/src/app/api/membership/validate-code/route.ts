import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Plan } from '@prisma/client';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

const fail = (status: number, error: string, message: string) =>
    NextResponse.json({ success: false, error, message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

// 仅预览优惠。结算必须重新验证并在订单事务中核销，不能信任客户端折扣。
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return fail(401, 'UNAUTHORIZED', '请先登录');
        const body = await req.json().catch(() => null);
        if (!body || typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(body.code.trim())) {
            return fail(400, 'INVALID_CODE', '请输入有效的优惠码');
        }
        if (typeof body.plan !== 'string' || !Object.values(Plan).includes(body.plan as Plan) || body.plan === 'FREE') {
            return fail(400, 'INVALID_PLAN', '请选择有效的付费会员计划');
        }
        const code = body.code.trim().toUpperCase();
        const discount = await prisma.discountCode.findUnique({ where: { code } });
        if (!discount || !discount.isActive) return fail(404, 'CODE_NOT_FOUND', '优惠码不存在或已停用');
        const now = Date.now();
        if (discount.validFrom.getTime() > now) return fail(400, 'CODE_NOT_STARTED', '优惠码尚未生效');
        if (discount.validUntil.getTime() <= now) return fail(400, 'CODE_EXPIRED', '优惠码已过期');
        if (!Number.isInteger(discount.discountPercent) || discount.discountPercent <= 0 || discount.discountPercent > 100
            || discount.usedCount < 0 || (discount.maxUses !== null && discount.maxUses < 0)) {
            return fail(503, 'CODE_UNAVAILABLE', '优惠码暂不可用');
        }
        if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) return fail(400, 'CODE_EXHAUSTED', '优惠码已用完');
        if (!discount.applicablePlans.includes(body.plan as Plan)) return fail(400, 'CODE_NOT_APPLICABLE', '该优惠码不适用于此会员计划');
        return NextResponse.json({ success: true, data: {
            code, discountPercent: discount.discountPercent,
            description: '减免原价的' + discount.discountPercent + '%',
            validUntil: discount.validUntil.toISOString(), previewOnly: true,
            message: '优惠资格以结算时核验结果为准',
        } }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch {
        return fail(503, 'SERVICE_UNAVAILABLE', '暂时无法验证优惠码，请稍后重试');
    }
}
