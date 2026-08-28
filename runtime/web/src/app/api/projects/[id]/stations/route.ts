import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { USAGE_LIMITS } from '@/lib/membership/plans';

type RouteContext = { params: Promise<{ id: string }> };

async function currentUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    return prisma.user.findUnique({ where: { id: session.user.id } });
}

function effectivePlan(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
    if (user.plan === 'FREE') return 'FREE' as const;
    return user.planExpireAt && user.planExpireAt > new Date() ? user.plan : 'FREE';
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { id: projectId } = await params;
    const project = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        include: { stations: { orderBy: { createdAt: 'desc' } } },
    });
    if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });

    const stations = project.stations;
    const measured = stations.filter(station => station.lastUpdated != null);
    return NextResponse.json({ success: true, data: {
        stations,
        summary: {
            total: stations.length,
            normal: stations.filter(station => station.status === 'normal').length,
            warning: stations.filter(station => station.status === 'warning').length,
            fault: stations.filter(station => station.status === 'fault').length,
            maintenance: stations.filter(station => station.status === 'maintenance').length,
            totalPower: measured.length
                ? measured.reduce((sum, station) => sum + (station.currentPower ?? 0), 0)
                : null,
            measuredStations: measured.length,
            note: measured.length ? null : '尚无经验证的 SCADA/IoT 测量数据',
        },
    } });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { id: projectId } = await params;
    const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
    if (!project) return NextResponse.json({ error: '项目不存在或无权访问' }, { status: 404 });

    const plan = effectivePlan(user);
    const limit = USAGE_LIMITS[plan].stations;
    const used = await prisma.station.count({ where: { userId: user.id } });
    if (limit !== Infinity && used >= limit) {
        return NextResponse.json({
            error: '当前会员等级的电站数量额度已用完，请先升级会员。',
            code: 'STATION_LIMIT_REACHED', limit, used,
        }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const type = String(body?.type ?? '').trim().toUpperCase();
    const lat = Number(body?.lat ?? project.lat);
    const lng = Number(body?.lng ?? project.lng);
    const capacity = body?.capacity == null ? null : Number(body.capacity);
    if (!name || !['SOLAR', 'WIND', 'STORAGE'].includes(type) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: '名称、类型和经纬度必须完整且有效' }, { status: 400 });
    }
    if (capacity != null && (!Number.isFinite(capacity) || capacity <= 0)) {
        return NextResponse.json({ error: '装机容量必须为正数' }, { status: 400 });
    }

    const station = await prisma.$transaction(async tx => {
        const created = await tx.station.create({
            data: { projectId, userId: user.id, name, type, lat, lng, capacity },
        });
        await tx.user.update({ where: { id: user.id }, data: { stationCount: { increment: 1 } } });
        return created;
    });
    return NextResponse.json({ success: true, data: station }, { status: 201 });
}
