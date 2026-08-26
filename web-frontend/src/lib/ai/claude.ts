// Claude AI服务 - 支持工具调用 (使用 OpenRouter 的 Claude Sonnet 4)
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt';
import { AI_TOOLS } from './tools';
import { executeTool } from './tool-executor';
import { Message } from '@/types';

// 创建Anthropic客户端 - 优先使用OpenRouter
function createClient(): Anthropic {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
        return new Anthropic({
            apiKey: openRouterKey,
            baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"
        });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY or OPENROUTER_API_KEY 未配置');
    }
    return new Anthropic({ apiKey });
}

// Claude Sonnet 4 模型配置
const DEFAULT_MODEL = process.env.OPENROUTER_API_KEY
    ? 'anthropic/claude-sonnet-4-20250514'  // OpenRouter 的 Claude Sonnet 4
    : 'claude-sonnet-4-20250514';            // 直接 Anthropic API


// 消息类型转换
interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string | Anthropic.Messages.ContentBlock[];
}

// 工具调用结果
interface ToolResult {
    toolName: string;
    toolInput: Record<string, unknown>;
    result: unknown;
}

// 聊天响应
export interface ChatResponse {
    content: string;
    toolCalls?: ToolResult[];
    stopReason?: string;
}

// 流式聊天配置
export interface StreamConfig {
    onToolCall?: (toolName: string, toolInput: Record<string, unknown>) => void;
    onToolResult?: (toolName: string, result: unknown) => void;
    onText?: (text: string) => void;
    onComplete?: (response: ChatResponse) => void;
}

// 非流式聊天
export async function chat(messages: Message[]): Promise<ChatResponse> {
    const client = createClient();

    // 转换消息格式 (Claude 只接受 user/assistant，system 消息需要单独传)
    let claudeMessages: Anthropic.Messages.MessageParam[] = messages
        .filter(m => m.role !== 'system')
        .map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'user' as const,
                    content: [{
                        type: 'tool_result',
                        tool_use_id: m.tool_call_id || '',
                        content: m.content
                    }] as Anthropic.Messages.ToolResultBlockParam[]
                };
            }
            return {
                role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                content: m.content
            };
        });

    // 初始调用
    let response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: AI_TOOLS,
        messages: claudeMessages
    });

    const toolCalls: ToolResult[] = [];
    let fullContent = '';

    // 工具调用循环
    while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
        );

        // 收集文本内容
        const textBlocks = response.content.filter(
            (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
        );
        fullContent += textBlocks.map(b => b.text).join('');

        // 执行工具
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
            console.log(`[Claude] 调用工具: ${toolUse.name}`, toolUse.input);

            const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

            toolCalls.push({
                toolName: toolUse.name,
                toolInput: toolUse.input as Record<string, unknown>,
                result
            });

            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: JSON.stringify(result)
            });
        }

        // 继续对话
        claudeMessages.push({
            role: 'assistant',
            content: response.content
        });
        claudeMessages.push({
            role: 'user',
            content: toolResults as any
        });

        response = await client.messages.create({
            model: DEFAULT_MODEL,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: AI_TOOLS,
            messages: claudeMessages
        });
    }

    // 提取最终文本
    const finalTextBlocks = response.content.filter(
        (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );
    fullContent += finalTextBlocks.map(b => b.text).join('');

    return {
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        stopReason: response.stop_reason || undefined
    };
}

// 流式聊天
export async function* chatStream(
    messages: Message[]
): AsyncGenerator<{ type: 'text' | 'tool_call' | 'tool_result'; data: unknown }> {
    const client = createClient();

    // 转换消息格式 (Claude 只接受 user/assistant，system 消息需要单独传)
    let claudeMessages: Anthropic.Messages.MessageParam[] = messages
        .filter(m => m.role !== 'system')
        .map(m => {
            if (m.role === 'tool') {
                return {
                    role: 'user' as const,
                    content: [{
                        type: 'tool_result',
                        tool_use_id: m.tool_call_id || '',
                        content: m.content
                    }] as Anthropic.Messages.ToolResultBlockParam[]
                };
            }
            return {
                role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
                content: m.content
            };
        });

    let continueLoop = true;

    while (continueLoop) {
        const stream = await client.messages.stream({
            model: DEFAULT_MODEL,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: AI_TOOLS,
            messages: claudeMessages
        });

        let currentToolUse: {
            id: string;
            name: string;
            input: string;
        } | null = null;

        const toolUseBlocks: Anthropic.Messages.ToolUseBlock[] = [];
        const contentBlocks: Anthropic.Messages.ContentBlock[] = [];

        for await (const event of stream) {
            if (event.type === 'content_block_start') {
                if (event.content_block.type === 'tool_use') {
                    currentToolUse = {
                        id: event.content_block.id,
                        name: event.content_block.name,
                        input: ''
                    };
                    yield {
                        type: 'tool_call',
                        data: { name: event.content_block.name, status: 'started' }
                    };
                }
            } else if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                    yield { type: 'text', data: event.delta.text };
                } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
                    currentToolUse.input += event.delta.partial_json;
                }
            } else if (event.type === 'content_block_stop') {
                if (currentToolUse) {
                    try {
                        const toolInput = JSON.parse(currentToolUse.input || '{}');
                        toolUseBlocks.push({
                            type: 'tool_use',
                            id: currentToolUse.id,
                            name: currentToolUse.name,
                            input: toolInput
                        });
                        contentBlocks.push({
                            type: 'tool_use',
                            id: currentToolUse.id,
                            name: currentToolUse.name,
                            input: toolInput
                        });
                    } catch (e) {
                        console.error('解析工具输入失败:', e);
                    }
                    currentToolUse = null;
                }
            }
        }

        const finalMessage = await stream.finalMessage();

        // 检查是否需要执行工具
        if (finalMessage.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
            const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

            for (const toolUse of toolUseBlocks) {
                yield {
                    type: 'tool_call',
                    data: { name: toolUse.name, status: 'executing' }
                };

                const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

                yield {
                    type: 'tool_result',
                    data: { name: toolUse.name, result }
                };

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result)
                });
            }

            // 准备下一轮对话
            claudeMessages.push({
                role: 'assistant',
                content: finalMessage.content
            });
            claudeMessages.push({
                role: 'user',
                content: toolResults
            });
        } else {
            continueLoop = false;
        }
    }
}

// 简单对话（无工具）
export async function simpleChat(prompt: string): Promise<string> {
    const client = createClient();

    const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = response.content.find(
        (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );

    return textBlock?.text || '';
}

// 导出服务
export const claudeService = {
    chat,
    chatStream,
    simpleChat
};
