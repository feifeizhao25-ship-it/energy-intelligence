import { requireAiQuota } from '@/lib/ai/quota-guard';
import { NextRequest } from 'next/server';
import { aiService } from '@/lib/ai/unified';
import { Message } from '@/types';
import { assistantChatStream } from '@/lib/assistant/agent';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import { getDefaultModel, getAvailableModels } from "@/lib/membership/plans";
import { Plan } from "@/lib/membership/plans";
import { safeErrorMessage } from '@/lib/api/safe-error';
import { aigcMeta, AIGC_HEADER } from '@/lib/ai/aigc';
import { BOTTOM_LINE_NOTICE_ZH, neutralizeCnText } from '@/lib/compliance/bottom-line';
import { collectSourcesFromToolResult, verifySources, type EvidenceSource } from '@/lib/evidence/verification';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions) as any;
        const body = await request.json().catch(() => null);
        if (!body) {
            return new Response(JSON.stringify({ error: '无效的消息格式' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { messages, provider, model: requestedModel, isAssistant } = body as {
            messages: Message[];
            provider?: string;
            model?: any;
            isAssistant?: boolean;
        };

        const latestUser = [...(body.messages || [])].reverse().find((item: Message) => item?.role === 'user');
        if (latestUser && neutralizeCnText(String(latestUser.content || '')) === BOTTOM_LINE_NOTICE_ZH) {
            const encoder = new TextEncoder();
            const blocked = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: BOTTOM_LINE_NOTICE_ZH })}\n\n`));
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                },
            });
            return new Response(blocked, { headers: { 'Content-Type': 'text/event-stream', [AIGC_HEADER]: '1' } });
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
            return new Response(
                JSON.stringify({ error: '无效的消息格式' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 登录 + 按库里的会员档扣减当日 AI 次数（原来不登录也能用，登录后也只事后记一笔）
        const guard = await requireAiQuota();
        if (!guard.ok) return guard.response;
        const userPlan = guard.plan as Plan;

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
                            plan: userPlan,
                            aigc: aigcMeta(actualModel),
                        }
                    })}\n\n`));

                    const chatSource = isAssistant
                        ? assistantChatStream(messages, actualModel, guard.userId)
                        : aiService.chatStream(messages, { provider: currentProvider, model: actualModel } as any);

                    // 次数已在门禁里扣减；这里只记明细日志
                    try {
                        const { logUsage } = await import('@/lib/membership/usage');
                        await logUsage(guard.userId, 'ai_chat', { model: actualModel, isAssistant });
                    } catch (usageError) {
                        console.warn('Usage log failed (non-blocking):', usageError);
                    }

                    const evidenceSources: EvidenceSource[] = [];
                    const textParts: string[] = [];
                    for await (const event of chatSource) {
                        // 转换事件类型以匹配前端期望
                        let transformedEvent = event;
                        if (event.type === 'text') {
                            textParts.push(String(event.data || ''));
                            continue;
                        } else if (event.type === 'tool_call') {
                            // 发送工具调用状态
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'status',
                                data: `正在调用工具: ${event.data.name}...`
                            })}\n\n`));
                            continue;
                        } else if (event.type === 'tool_result') {
                            evidenceSources.push(...collectSourcesFromToolResult(event.data?.name, event.data?.result));
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
                    const answer = neutralizeCnText(textParts.join(''));
                    if (answer) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: answer })}\n\n`));
                    }
                    // 审计 7-5：回答结束时按多源验证规则给出核验状态（前端引用卡显示 已核验/待核验/冲突）
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'evidence',
                        data: { verification: verifySources(evidenceSources), sources: evidenceSources.slice(0, 20) },
                    })}\n\n`));
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('流处理错误:', error);
                    const errorData = JSON.stringify({
                        type: 'error',
                        data: { message: safeErrorMessage(error, '未知错误') }
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
                'Connection': 'keep-alive',
                [AIGC_HEADER]: '1',
            }
        });
    } catch (error) {
        console.error('Chat API错误:', error);
        return new Response(
            JSON.stringify({
                error: safeErrorMessage(error, '服务器错误')
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
                message: '新能源智库 AI 对话API',
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
                message: '新能源智库 AI 对话API',
                error: safeErrorMessage(error, '未配置AI服务')
            }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
}

