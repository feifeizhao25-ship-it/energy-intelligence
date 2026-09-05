import { NextRequest, NextResponse } from 'next/server';
import { generateSummary, extractKeyData, translateText, generateFullTranslation } from '@/lib/papers/ai';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    if (!body || !['summary', 'key_data', 'translate', 'full_translation'].includes(body.action)) {
        return NextResponse.json({ error: '请选择有效的文献处理操作' }, { status: 400 });
    }
    const { action, text, title } = body;
    if (typeof text !== 'string' || !text.trim() || text.length > 200000 ||
        (title != null && (typeof title !== 'string' || title.length > 2000))) {
        return NextResponse.json({ error: '请输入有效的文献内容，正文最多 200000 个字符，标题最多 2000 个字符' }, { status: 400 });
    }
    try {

        let result;

        switch (action) {
            case 'summary':
                result = await generateSummary(text, title);
                break;
            case 'key_data':
                result = await extractKeyData(text);
                break;
            case 'translate':
                result = await translateText(text);
                break;
            case 'full_translation':
                result = await generateFullTranslation(text);
                break;
            default:
                return NextResponse.json({ error: '请选择有效的文献处理操作' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result
        });
    } catch {
        return NextResponse.json(
            { error: '文献处理服务暂时不可用，请稍后重试', code: 'UPSTREAM_UNAVAILABLE' },
            { status: 503 }
        );
    }
}
