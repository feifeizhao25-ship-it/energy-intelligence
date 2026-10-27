import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import resources from '@/data/domestic-resources.json';

export async function GET() {
    const now = new Date();
    const cards: Array<{ title: string; value: string; unit: string; note: string; source: string; loaded: boolean }> = [
        {
            title: '样本覆盖',
            value: String((resources.stations || []).length),
            unit: '个省级城市气候样本',
            note: '来自国内离线样本，不是 NASA POWER 实测，也不是官方辐照公报。',
            source: 'domestic-resources.json',
            loaded: true,
        },
        {
            title: '已核验电价',
            value: '0',
            unit: '条',
            note: '数据集价格列标为样本（未载入已核验电价）。没有带来源的官方电价时不填数字。',
            source: 'cn-datasets.json',
            loaded: true,
        },
    ];
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
        cards.unshift({
            title: '政策条目',
            value: String(count),
            unit: '条已审核且处于生效期的政策',
            note: '计数来自本站政策库，不是电价，也不是发电量。',
            source: '政策库',
            loaded: true,
        });
    } catch {
        cards.unshift({
            title: '政策条目',
            value: '—',
            unit: '条',
            note: '政策库尚未连接。',
            source: '政策库',
            loaded: false,
        });
    }
    return NextResponse.json({ success: true, data: cards[0], cards });
}
