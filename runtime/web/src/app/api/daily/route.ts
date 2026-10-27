import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    const now = new Date();
    try {
        const count = await prisma.policy.count({
            where: {
                reviewStatus: 'APPROVED',
                AND: [
                    { OR: [{ startDate: null }, { startDate: { lte: now } }] },
                    { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                ],
            },
        });
        return NextResponse.json({
            success: true,
            data: {
                title: '每日一数',
                value: String(count),
                unit: '条已审核且处于生效期的政策',
                note: '计数来自本站政策库，不是电价，也不是发电量。',
                loaded: true,
            },
        });
    } catch {
        return NextResponse.json({
            success: true,
            data: { title: '每日一数', value: '—', unit: '', note: '数据尚未加载。', loaded: false },
        });
    }
}
