import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { consumeQuota } from '@/lib/audit/quota';
import { authOptions } from '@/lib/auth/auth-options';
import { effectivePlan } from '@/lib/auth/token-refresh';
import { readAnswer } from '@/lib/assistant/answer-store';
import { renderAnswerDocx, renderAnswerPdf } from '@/lib/assistant/answer-file';
import { EXPORT_FORMATS, FEATURE_ACCESS } from '@/lib/membership/plans';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Download one answer this session already received.
 * The file is built from the stored reply, not from titles or excerpts in the request body.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录后再导出' }, { status: 401 });
  }
  const { id } = await context.params;
  const record = readAnswer(id);
  if (!record || record.userId !== session.user.id) {
    return NextResponse.json({ error: 'NOT_FOUND', message: '回答不存在或无权访问' }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const format = body?.format;
  if (format !== 'pdf' && format !== 'docx') {
    return NextResponse.json({ error: 'UNSUPPORTED_FORMAT', message: '回答导出只支持 PDF 或 Word' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, planExpireAt: true },
  });
  const plan = effectivePlan(user?.plan, user?.planExpireAt) as keyof typeof EXPORT_FORMATS;
  if (format === 'docx') {
    const allowed = (EXPORT_FORMATS[plan] ?? []) as readonly string[];
    if (!allowed.includes('Word')) {
      return NextResponse.json(
        { error: 'FORMAT_NOT_INCLUDED', message: '当前套餐不含 Word 导出，可导出 PDF，或升级到专业版及以上' },
        { status: 403 },
      );
    }
  }
  const watermark = !(FEATURE_ACCESS.no_watermark as readonly string[]).includes(plan);
  let file: Buffer;
  try {
    file = format === 'pdf' ? await renderAnswerPdf(record, watermark) : renderAnswerDocx(record, watermark);
  } catch (error) {
    console.error('answer export render failed', error);
    return NextResponse.json({ error: 'EXPORT_RENDER_FAILED', message: '导出文件暂时无法生成，额度未扣减' }, { status: 500 });
  }
  const quota = await consumeQuota(session.user.id, 'EXPORTS');
  if (!quota.success) {
    return NextResponse.json({
      error: 'EXPORT_QUOTA_EXCEEDED',
      message: quota.usage.exceeded ? '本月报告导出额度已用尽，请查看套餐或下月再试' : '导出额度暂时无法核验，请稍后重试',
    }, { status: quota.usage.exceeded ? 429 : 503 });
  }
  const filename = format === 'pdf' ? 'answer.pdf' : 'answer.docx';
  const type = format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
