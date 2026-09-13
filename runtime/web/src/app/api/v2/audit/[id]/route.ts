/**
 * 🏰 护城河系统：审计数据 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return respond(401, { error: '请先登录' });

        const snapshot = await prisma.calculationSnapshot.findFirst({
            where: { id: params.id, userId: session.user.id },
            include: {
                project: true,
                user: { select: { name: true, avatar: true } }
            }
        });

        if (!snapshot) return respond(404, { error: '计算记录不存在或无法访问' });

        return respond(200, snapshot);
    } catch (error) {
        return respond(503, { error: '计算记录暂时无法读取，请稍后重试' });
    }
}

function respond(status: number, body: object) {
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
