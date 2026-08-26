import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true, name: true, email: true, plan: true, planExpireAt: true,
            dailyAiCalls: true, dailyResourceQueries: true, dailyCalculations: true,
            dailyPaperSearches: true, dailyDiagnoses: true, projectCount: true,
            paperCount: true, stationCount: true, folderCount: true,
            subscription: {
                select: {
                    status: true, endDate: true, autoRenew: true,
                    payments: {
                        where: { status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 20,
                        select: { id: true, amount: true, currency: true, paymentMethod: true, description: true, paidAt: true, createdAt: true },
                    },
                },
            },
        },
    });

    if (!user) {
        return NextResponse.json({ success: false, error: 'NOT_FOUND', message: '用户不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: user });
}
