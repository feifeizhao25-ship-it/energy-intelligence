import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai/unified';

/**
 * 对搜索结果进行 AI 汇总分析
 */
export async function POST(req: NextRequest) {
    try {
        const { query, papers } = await req.json();

        if (!papers || papers.length === 0) {
            return NextResponse.json({ error: '没有提供论文数据' }, { status: 400 });
        }

        const paperContext = papers.map((p: any, i: number) =>
            `${i + 1}. [${p.year}] ${p.title}\n摘要: ${p.tldr || p.abstract || '无'}`
        ).join('\n\n');

        const prompt = `你是一个新能源智库专家。针对用户搜索的主题 "${query}"，根据以下 ${papers.length} 篇相关论文的摘要，分析该领域的研究现状、主要技术路线、目前面临的挑战以及未来趋势。
请用专业、简洁的中文回答，分点列出，不超过 500 字。

论文列表：
${paperContext}`;

        const response = await aiService.chat(
            [
                { role: 'system', content: '你是一个新能源领域的学术分析专家，擅长从多篇文献中提取关键趋势。' },
                { role: 'user', content: prompt }
            ],
            { model: 'glm-4-plus' }
        );

        return NextResponse.json({ success: true, analysis: response.content });

    } catch (error: any) {
        console.error('[Analyze Search API] Error:', error);
        return NextResponse.json({ error: '分析失败' }, { status: 500 });
    }
}
