import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { exportUserData } from '@/lib/account/erasure';

export const dynamic = 'force-dynamic';

/** 导出本人的全部个人数据（JSON 下载）。 */
export async function GET() {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const data = await exportUserData(prisma as never, userId);
    return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': `attachment; filename="xinnengyuan-export-${new Date().toISOString().slice(0, 10)}.json"`,
            'cache-control': 'no-store',
        },
    });
}
