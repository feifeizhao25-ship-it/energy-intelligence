import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import resources from '@/data/domestic-resources.json';
import { readVerifiedTariffs } from '@/lib/data/verified-tariffs';

export async function GET() {
    const now = new Date();
    const cards: Array<{ title: string; value: string; unit: string; note: string; source: string; loaded: boolean }> = [
        {
            title: '样本覆盖',
            value: String((resources.stations || []).length),
            unit: '个省级城市气候样本',
            note: '离线缓存的 NASA POWER 气候态月均值（2001–2025，省会坐标点），卫星与再分析产品，不是地面气象站实测，也不是官方辐照公报。',
            source: 'NASA POWER（https://power.larc.nasa.gov）',
            loaded: true,
        },
        {
            title: '已核验电价',
            value: readVerifiedTariffs().loaded ? String(readVerifiedTariffs().rows.length) : '—',
            unit: '条',
            note: readVerifiedTariffs().loaded ? '条数只统计带来源链接和 asOf 的记录，这里不展示电价本身。' : '尚未载入已核验电价，因此不显示金额。',
            source: readVerifiedTariffs().loaded ? readVerifiedTariffs().rows[0].sourceUrl : '已核验电价表',
            loaded: readVerifiedTariffs().loaded,
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
