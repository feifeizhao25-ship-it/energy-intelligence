import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { tierOf } from '@/lib/entitlements/access';
import catalog from '@/data/cn-datasets.json';

function csvEscape(value: string) {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
}

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: true, data: catalog });
    const dataset = catalog.datasets.find((item) => item.id === id);
    if (!dataset) return NextResponse.json({ error: '没有这个数据集' }, { status: 404 });
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
    const quota = Number(tierOf(user?.plan, user?.planExpireAt)?.quotas?.dataset_downloads_per_month ?? 0);
    const start = new Date();
    start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    const used = await prisma.datasetDownload.count({ where: { userId: session.user.id, createdAt: { gte: start } } });
    if (quota !== -1 && used >= quota) {
        return NextResponse.json({ error: '本月数据集下载次数已用完' }, { status: 429 });
    }
    await prisma.datasetDownload.create({ data: { userId: session.user.id, datasetId: id } });
    const lines = [dataset.columns.join(',')];
    for (const row of dataset.rows) lines.push(row.map((cell) => csvEscape(String(cell))).join(','));
    lines.push(`# ${catalog.license_note}`);
    return new NextResponse(lines.join('\n'), {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${id}.csv"`,
        },
    });
}
