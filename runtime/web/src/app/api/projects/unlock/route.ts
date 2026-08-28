import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    return NextResponse.json({
        success: false,
        error: '报告不能由前端按钮直接解锁。请在会员页完成支付，权益仅由已验签支付回调或已审核企业合同开通。',
        code: 'VERIFIED_ENTITLEMENT_REQUIRED',
    }, { status: 402 });
}
