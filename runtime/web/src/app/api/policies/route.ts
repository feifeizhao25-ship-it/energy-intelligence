import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const now = new Date();
    const rows = await prisma.policy.findMany({
        where: {
            reviewStatus: 'APPROVED',
            AND: [
                { OR: [{ startDate: null }, { startDate: { lte: now } }] },
                { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                ...(q ? [{ OR: [
                    { region: { contains: q } },
                    { sourceTitle: { contains: q } },
                    { docNumber: { contains: q } },
                    { type: { contains: q } },
                ] }] : []),
            ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
    });
    return NextResponse.json({ success: true, data: rows, note: '只显示已审核且处于生效期内的条目。' });
}
