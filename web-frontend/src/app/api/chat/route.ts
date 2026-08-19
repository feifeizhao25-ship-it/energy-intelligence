import { NextRequest } from 'next/server';
import { aiService } from '@/lib/ai/unified';
import { Message } from '@/types';
import { assistantChatStream } from '@/lib/assistant/agent';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import { getDefaultModel, getAvailableModels } from "@/lib/membership/plans";
import { Plan } from "@/lib/membership/plans";

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        const userPlan = (session?.user?.plan as Plan) || Plan.FREE;

        const body = await request.json();
        const { messages, provider, model: requestedModel, isAssistant } = body as {
            messages: Message[];
            provider?: string;
            model?: any;
            isAssistant?: boolean;
        };

        if (!messages || !Array.isArray(messages)) {
            return new Response(
                JSON.stringify({ error: '无效的消息格式' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Determine the actual model based on user plan
        let actualModel = requestedModel;
        const availableModels = getAvailableModels(userPlan);
        const defaultModel = getDefaultModel(userPlan);

        if (!actualModel || !availableModels.includes(actualModel)) {
            actualModel = defaultModel;
        }

        // 创建可读流
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const currentProvider = provider || aiService.getAIProvider();

                    // 发送提供商信息
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'provider',
                        data: {
                            provider: isAssistant ? 'agent' : currentProvider,
                            model: actualModel,
                            plan: userPlan
                        }
                    })}\n\n`));

                    const chatSource = isAssistant
                        ? assistantChatStream(messages, actualModel, session?.user?.id)
                        : aiService.chatStream(messages, { provider: currentProvider, model: actualModel } as any);

                    // 如果有登录用户，记录并增加使用量（不阻塞响应）
                    if (session?.user?.id) {
                        try {
                            const { incrementUsage, logUsage } = await import('@/lib/membership/usage');
                            await Promise.all([
                                incrementUsage(session.user.id, 'ai_chat'),
                                logUsage(session.user.id, 'ai_chat', { model: actualModel, isAssistant })
                            ]);
                        } catch (usageError) {
                            console.warn('Usage tracking failed (non-blocking):', usageError);
                        }
                    }

                    for await (const event of chatSource) {
                        // 转换事件类型以匹配前端期望
                        let transformedEvent = event;
                        if (event.type === 'text') {
                            transformedEvent = { type: 'content', data: event.data };
                        } else if (event.type === 'tool_call') {
                            // 发送工具调用状态
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'status',
                                data: `正在调用工具: ${event.data.name}...`
                            })}\n\n`));
                            continue;
                        } else if (event.type === 'tool_result') {
                            // 发送工具结果状态
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'status',
                                data: `工具 ${event.data.name} 执行完成`
                            })}\n\n`));
                            continue;
                        }

                        const data = JSON.stringify(transformedEvent);
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('流处理错误:', error);
                    const errorData = JSON.stringify({
                        type: 'error',
                        data: { message: error instanceof Error ? error.message : '未知错误' }
                    });
                    controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        console.error('Chat API错误:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : '服务器错误'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// API信息端点
export async function GET() {
    try {
        const status = aiService.getServiceStatus();
        const models = aiService.getAvailableModels();

        return new Response(
            JSON.stringify({
                message: 'SolarWind Pro AI对话API',
                usage: 'POST /api/chat with { messages: [{role, content}], provider?: string, model?: string }',
                streaming: true,
                status,
                availableModels: models
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({
                message: 'SolarWind Pro AI对话API',
                error: error instanceof Error ? error.message : '未配置AI服务'
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
}

