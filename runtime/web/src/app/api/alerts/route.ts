import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import { tierOf } from '@/lib/entitlements/access';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const [subscriptions, notices] = await Promise.all([
        prisma.policyAlertSubscription.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' } }),
        prisma.policyAlertNotice.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return NextResponse.json({ success: true, data: { subscriptions, notices } });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { plan: true, planExpireAt: true } });
    const level = String(tierOf(user?.plan, user?.planExpireAt)?.capabilities?.policy_alerts || 'none');
    if (level === 'none') return NextResponse.json({ error: '当前套餐不含政策提醒' }, { status: 403 });
    const body = await req.json().catch(() => null);
    const province = String(body?.province || '').trim();
    const topic = String(body?.topic || '').trim();
    if (!province || province.length > 32) return NextResponse.json({ error: '请填写省份' }, { status: 400 });
    if (level === 'province_topic' && topic.length > 40) return NextResponse.json({ error: '主题过长' }, { status: 400 });
    const subscription = await prisma.policyAlertSubscription.create({
        data: {
            userId: session.user.id,
            province,
            topic,
            channelInApp: true,
            channelEmail: Boolean(body?.email),
            channelWecom: Boolean(body?.wecom),
        },
    });
    const now = new Date();
    const matches = await prisma.policy.findMany({
        where: {
            reviewStatus: 'APPROVED',
            region: { contains: province },
            ...(topic ? { OR: [{ sourceTitle: { contains: topic } }, { docNumber: { contains: topic } }, { type: { contains: topic } }] } : {}),
            AND: [
                { OR: [{ startDate: null }, { startDate: { lte: now } }] },
                { OR: [{ endDate: null }, { endDate: { gte: now } }] },
            ],
        },
        take: 10,
    });
    if (matches.length) {
        await prisma.policyAlertNotice.createMany({
            data: matches.map((policy) => ({
                userId: session.user.id,
                title: policy.sourceTitle || policy.docNumber || policy.region,
                body: `${policy.region} ${policy.docNumber || ''} 已在生效期内。邮件和企微只在对应通道配置后发送。`.trim(),
            })),
        });
    }
    return NextResponse.json({ success: true, data: { subscription, matched: matches.length, email: subscription.channelEmail ? '已记录，待邮件通道配置后发送' : '未选邮件', wecom: subscription.channelWecom ? '已记录，待企微配置后发送' : '未选企微' } });
}
