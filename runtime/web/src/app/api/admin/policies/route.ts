import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireReviewer } from '@/lib/admin/require-reviewer';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

/** GET /api/admin/policies?status=PENDING —— 政策审核列表（最多 100 条，新抓取的在前） */
export async function GET(req: NextRequest) {
    const auth = await requireReviewer();
    if (!auth.ok) return auth.response;
    const raw = req.nextUrl.searchParams.get('status') ?? 'PENDING';
    const status = (STATUSES as readonly string[]).includes(raw) ? raw as typeof STATUSES[number] : 'PENDING';
    const [items, counts] = await Promise.all([
        prisma.policy.findMany({
            where: { reviewStatus: status },
            orderBy: [{ fetchedAt: 'desc' }, { updatedAt: 'desc' }],
            take: 100,
        }),
        prisma.policy.groupBy({ by: ['reviewStatus'], _count: { _all: true } }),
    ]);
    return NextResponse.json({
        success: true,
        status,
        counts: Object.fromEntries(counts.map(c => [c.reviewStatus, c._count._all])),
        items,
    });
}
