/**
 * 🏰 护城河系统：审计数据 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const snapshot = await prisma.calculationSnapshot.findFirst({
            where: { id: params.id, userId: session.user.id },
            include: {
                project: true,
                user: { select: { name: true, avatar: true } }
            }
        });

        if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

        return NextResponse.json(snapshot);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
