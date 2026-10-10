import { NextResponse } from 'next/server';
import { PolicyService } from '@/lib/services/policy-service';
import { reviewerLabel } from '@/lib/admin/policy-reviewers';
import { requireReviewer } from '@/lib/admin/require-reviewer';

/**
 * POST /api/admin/policies/:id/review  { decision: 'APPROVED' | 'REJECTED' }
 * 审核人取当前登录的审核员（姓名 + 用户 ID），审核时间由服务端记录；不接受客户端自报审核人。
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireReviewer();
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const decision = body?.decision;
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        return NextResponse.json({ error: '请选择「通过」或「驳回」' }, { status: 400 });
    }
    try {
        const policy = await PolicyService.reviewPolicy(id, decision, reviewerLabel(auth.user));
        return NextResponse.json({ success: true, policy });
    } catch {
        return NextResponse.json({ error: '政策不存在或已被删除' }, { status: 404 });
    }
}
