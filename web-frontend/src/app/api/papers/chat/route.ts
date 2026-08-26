import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { ragProcessor } from '@/lib/papers/rag';
import { aiService } from '@/lib/ai/unified';

/**
 * 文献 RAG 对话接口
 */
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return new Response(JSON.stringify({ error: '未授权' }), { status: 401 });
    }

    try {
        const { messages, paperId } = await req.json();
        const lastMessage = messages[messages.length - 1].content;

        // 1. 检索相关上下文
        const contextChunks = await ragProcessor.searchContext(lastMessage, paperId, 5);
        const contextText = contextChunks.map((c: any) => c.content).join('\n\n---\n\n');

        // 2. 构建系统提示词
        const systemPrompt = `你是一位专业的新能源学术助手。以下是从论文中提取的相关片段，请结合这些内容回答用户的问题。
如果片段中没有相关信息，请诚实告知，不要捏造事实。请使用中文回答。

相关内容库：
${contextText}

注意：仅参考提供的片段，并在回答中尽量引用原文细节。`;

        // 3. 调用 AI 流式响应
        const responseMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(0, -1),
            { role: 'user', content: lastMessage }
        ];

        const stream = aiService.chatStream(responseMessages, {
            model: 'glm-4-plus',
            temperature: 0.3
        });

        // 4. 返回流
        const encoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            }
        });

        return new Response(readableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

    } catch (error: any) {
        console.error('[RAG API] Chat failed:', error);
        return new Response(JSON.stringify({ error: error.message || '对话失败' }), { status: 500 });
    }
}
