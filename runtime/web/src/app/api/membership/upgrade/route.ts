import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }
    // 仅经支付渠道签名验证的服务端 webhook 可以创建订单并变更权益。
    return NextResponse.json({
        success: false,
        error: 'PAYMENT_CHANNEL_UNAVAILABLE',
        message: '在线支付通道尚未启用，请联系销售获取正式合同与付款方式。',
    }, { status: 503 });
}
