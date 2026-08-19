// 统一AI服务 - 全面接入国产大模型路由 (SiliconFlow)
import { Message } from '@/types';
import { callAI, AIModel, createEmbedding } from './router';

// 获取当前配置的AI提供商 (现在统一为 siliconflow 或 mock)
export function getAIProvider(): string {
    return process.env.SILICONFLOW_API_KEY ? 'siliconflow' : 'mock';
}

// AI服务配置
export interface AIServiceConfig {
    model?: AIModel;
    temperature?: number;
}

// 统一的聊天响应
export interface UnifiedChatResponse {
    content: string;
    provider: string;
    model: string;
}

/**
 * 统一非流式聊天
 */
export async function chat(
    messages: Message[],
    config?: AIServiceConfig
): Promise<UnifiedChatResponse> {
    const model = config?.model || 'glm-4-plus';

    // @ts-ignore
    const response = await callAI({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: config?.temperature || 0.7
    });

    return {
        // @ts-ignore
        content: response.choices[0].message.content,
        provider: 'siliconflow',
        model: model
    };
}

/**
 * 统一流式聊天生成器
 */
export async function* chatStream(
    messages: Message[],
    config?: AIServiceConfig
): AsyncGenerator<{ type: string; data: unknown }> {
    const model = config?.model || 'glm-4-plus';

    // @ts-ignore
    const stream: any = await callAI({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: config?.temperature || 0.7,
        stream: true
    });

    for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
            yield { type: 'content', data: content };
        }
    }
}

/**
 * 简单对话助手 (常用)
 */
export async function simpleChat(
    prompt: string,
    model?: AIModel
): Promise<string> {
    // @ts-ignore
    const response = await callAI({
        model: model || 'glm-4-plus',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
    });

    // @ts-ignore
    return response.choices[0].message.content;
}

/**
 * 获取可用的AI模型列表
 */
export function getAvailableModels() {
    return [
        { name: '智谱 GLM-4 (推荐)', id: 'glm-4-plus', description: '国产全性能旗舰，长文本处理能力强' },
        { name: 'Kimi V1', id: 'kimi-v1', description: '擅长文献分析与超长上下文理解' },
        { name: 'MiniMax 6.5', id: 'minimax-abab6.5', description: '逻辑推理能力极其出色' },
        { name: 'DeepSeek V3', id: 'deepseek-v3', description: '极致性价比，工程计算与逻辑分析首选' },
    ];
}

/**
 * 获取当前服务状态
 */
export function getServiceStatus() {
    return {
        siliconflow: {
            configured: !!process.env.SILICONFLOW_API_KEY,
            status: 'active'
        },
        currentProvider: getAIProvider(),
        defaultModel: 'glm-4-plus'
    };
}

export const aiService = {
    chat,
    chatStream,
    simpleChat,
    createEmbedding,
    getAvailableModels,
    getServiceStatus,
    getAIProvider
};
