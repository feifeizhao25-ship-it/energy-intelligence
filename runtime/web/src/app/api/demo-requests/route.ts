import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateDemoRequest, isDuplicateRequest } from '@/lib/demo-requests/validation';

export const dynamic = 'force-dynamic';

/**
 * 企业预约演示请求。
 *
 * 不依赖外部 CRM：请求直接落库（demo_requests 表），由运营侧处理。
 * 数据库不可用时返回 503（fail-closed），不静默假成功。
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON' }, { status: 400 });
    }

    const result = validateDemoRequest(body);
    if (!result.ok) {
        return NextResponse.json({ error: '字段校验未通过', details: result.errors }, { status: 422 });
    }

    try {
        // 防重复提交：同一邮箱在窗口期内已有待处理请求时拒绝
        const existing = await prisma.demoRequest.findFirst({
            where: { email: result.data.email, status: 'new' },
            orderBy: { createdAt: 'desc' },
        });
        if (isDuplicateRequest(existing)) {
            return NextResponse.json(
                { error: '已收到您的演示请求，我们会尽快与您联系，请勿重复提交', code: 'DUPLICATE' },
                { status: 409 },
            );
        }

        const record = await prisma.demoRequest.create({ data: result.data });
        return NextResponse.json(
            { id: record.id, status: record.status, message: '演示请求已提交，我们会尽快与您联系' },
            { status: 201 },
        );
    } catch (error) {
        console.error('Demo request persistence error:', error);
        return NextResponse.json(
            { error: '演示请求服务暂时不可用，请稍后重试' },
            { status: 503 },
        );
    }
}
