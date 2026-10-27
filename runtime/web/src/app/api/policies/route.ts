import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { effectiveOn, type VersionedRecord } from '@/lib/policy/as-of';
import { DEMO_POLICIES } from '@/lib/policy/demo-library';

function day(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get('q') || '').trim();
    const asOf = (req.nextUrl.searchParams.get('asOf') || '').trim();
    const now = new Date();
    try {
        const rows = await prisma.policy.findMany({
            where: {
                reviewStatus: 'APPROVED',
                ...(asOf ? {} : {
                    AND: [
                        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
                        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
                    ],
                }),
                ...(q ? { OR: [
                    { region: { contains: q } },
                    { sourceTitle: { contains: q } },
                    { docNumber: { contains: q } },
                    { type: { contains: q } },
                ] } : {}),
            },
            orderBy: { updatedAt: 'desc' },
            take: 50,
        });
        const versioned: VersionedRecord[] = rows.map((row) => ({
            ...row,
            source_id: row.id,
            effective_date: day(row.effectiveDate) || day(row.startDate),
            expiry_date: day(row.expiryDate) || day(row.endDate),
            superseded_by: row.supersededBy,
        }));
        const data = asOf ? effectiveOn(versioned, asOf) : versioned;
        return NextResponse.json({
            success: true,
            sample: false,
            data,
            note: asOf ? `按 ${asOf} 回看当时仍生效的已审核条目。` : '只显示已审核且处于生效期内的条目。',
        });
    } catch {
        if (process.env.NENGJIAN_DEMO_DATA !== '1') {
            return NextResponse.json({ success: false, sample: false, data: [], note: '政策库未连接' }, { status: 503 });
        }
        const matched = DEMO_POLICIES.filter((row) => !q || `${row.title}${row.doc_number}${row.region}`.includes(q));
        const data = asOf ? effectiveOn(matched, asOf) : matched;
        return NextResponse.json({
            success: true,
            sample: true,
            data,
            note: asOf
                ? `示例。按 ${asOf} 回看下列已收录文号，不是数据库快照。`
                : '示例。政策库未连接，这里只列出已收录文号，不是数据库快照。',
        });
    }
}
