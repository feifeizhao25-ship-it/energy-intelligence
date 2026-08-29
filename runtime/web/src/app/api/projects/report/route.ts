import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    return NextResponse.json({
        error: '旧版浏览器报告接口已停用。报告导出必须由服务端校验会员额度并生成审计记录。',
        code: 'SERVER_REPORT_EXPORT_REQUIRED',
    }, { status: 410 });
}
