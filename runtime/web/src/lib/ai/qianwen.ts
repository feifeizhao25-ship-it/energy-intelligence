// 硅基流动 AI 服务 - 支持 Qwen, DeepSeek, GLM 等模型 (OpenAI 兼容接口)
import { Message } from '@/types';
import { AI_TOOLS } from './tools';
import { executeTool } from './tool-executor';

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const SILICONFLOW_BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';

// 硅基流动支持的模型配置 (按用户指定的最强模型)
export const AI_MODELS = {
    // DeepSeek 系列
    'deepseek-v3': 'deepseek-ai/DeepSeek-V3', // 稳定版
    'deepseek-v3-exp': 'deepseek-ai/DeepSeek-V3.2-Exp', // 实验版 (Pro)
    'deepseek-v3-pro': 'Pro/deepseek-ai/DeepSeek-V3.2-Exp', // Pro版

    // GLM 系列
    'glm-4-plus': 'Pro/zai-org/GLM-4.7', // 最强 GLM
    'glm-4-air': 'zai-org/GLM-4.6',

    // Kimi (Moonshot) 系列
    'kimi-k2-thinking': 'moonshotai/Kimi-K2-Thinking', // 思考模型
    'kimi-k2-pro': 'Pro/moonshotai/Kimi-K2-Thinking',
    'kimi-k2-instruct': 'moonshotai/Kimi-K2-Instruct-0905',

    // 其他顶尖模型
    'kat-dev': 'Kwaipilot/KAT-Dev', // 快手
    'minimax-m2': 'MiniMaxAI/MiniMax-M2', // MiniMax
    'ling-1t': 'inclusionAI/Ling-1T' // 01万物
};

// 默认使用 DeepSeek V3 (稳定且强大)
const DEFAULT_MODEL = AI_MODELS['deepseek-v3'];

// 系统提示词
const SYSTEM_PROMPT = `你是新能源智库——新能源项目智能决策系统的AI助手。你专精于：

1. **光伏发电系统**：太阳能电池技术、组件选型、系统设计、发电量预测
2. **风力发电系统**：风机选型、风资源评估、选址分析、运维管理
3. **储能系统**：电池储能、抽水蓄能、储能配置优化
4. **新能源政策**：补贴政策、并网要求、电力交易规则
5. **项目投资分析**：投资回报、风险评估、融资策略

请用专业但易懂的方式回答问题，并在适当时提供具体的数据和计算结果。`;

// 转换 Anthropic 工具定义为 OpenAI 格式
function convertToOpenAITools(tools: typeof AI_TOOLS) {
    return Object.values(tools).map(tool => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }
    }));
}

// 聊天响应接口
export interface SiliconFlowChatResponse {
    content: string;
    model: string;
    toolCalls?: Array<{
        toolName: string;
        toolInput: Record<string, unknown>;
        result: unknown;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// 非流式聊天
export async function chat(messages: Message[], model: string = DEFAULT_MODEL): Promise<SiliconFlowChatResponse> {
    if (!SILICONFLOW_API_KEY) {
        throw new Error('SILICONFLOW_API_KEY 未配置');
    }

    console.log('[SiliconFlow] 调用模型:', model);

    const openAITools = convertToOpenAITools(AI_TOOLS);
    let currentMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    let finalToolCalls: any[] = [];

    // 循环处理工具调用
    let keepCalling = true;
    let iterations = 0;
    const MAX_ITERATIONS = 5; // 防止无限循环

    let lastContent = '';
    let lastUsage;

    while (keepCalling && iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
            signal: AbortSignal.timeout(60_000),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: currentMessages,
                tools: openAITools,
                tool_choice: 'auto', // 让模型自己决定是否调用工具
                max_tokens: 4096,
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('SiliconFlow API错误:', response.status, errorText);
            throw new Error(`SiliconFlow API 调用失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const message = data.choices[0]?.message;
        lastContent = message.content || '';
        lastUsage = data.usage;

        // 如果有工具调用
        if (message.tool_calls && message.tool_calls.length > 0) {
            console.log(`[SiliconFlow] 模型请求调用 ${message.tool_calls.length} 个工具`);

            // 将助手的回复加入历史
            currentMessages.push({
                role: 'assistant',
                content: message.content, // 内容可能为空，如果是工具调用
                tool_calls: message.tool_calls
            } as any);

            // 执行所有工具
            for (const toolCall of message.tool_calls) {
                const functionName = toolCall.function.name;
                const argumentsStr = toolCall.function.arguments;
                let functionArgs = {};

                try {
                    functionArgs = JSON.parse(argumentsStr);
                } catch (e) {
                    console.error(`解析工具参数失败 ${functionName}:`, e);
                }

                console.log(`[SiliconFlow] 执行工具: ${functionName}`, functionArgs);

                let result;
                try {
                    result = await executeTool(functionName, functionArgs);
                } catch (e: any) {
                    result = { error: e.message };
                }

                finalToolCalls.push({
                    toolName: functionName,
                    toolInput: functionArgs,
                    result
                });

                // 将工具结果加入消息历史
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                } as any);
            }
        } else {
            // 没有工具调用，结束循环
            keepCalling = false;
        }
    }

    return {
        content: lastContent,
        model: model,
        usage: lastUsage,
        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined
    };
}

// 流式聊天生成器
export async function* chatStream(
    messages: Message[],
    model: string = DEFAULT_MODEL
): AsyncGenerator<{ type: 'text' | 'done' | 'tool_call' | 'tool_result'; data: any }> {
    if (!SILICONFLOW_API_KEY) {
        throw new Error('SILICONFLOW_API_KEY 未配置');
    }

    console.log('[SiliconFlow] 流式调用模型:', model);

    const openAITools = convertToOpenAITools(AI_TOOLS);
    let currentMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    // 处理循环工具调用的逻辑在流式模式下比较复杂
    // 目前简化为：如果第一轮生成了工具调用，我们就在服务器端处理完逻辑（非流式等待工具执行），
    // 然后再发起一个新的流式请求来生成最终回答。
    // 这是一种混合模式，确保前端体验流畅。

    // 1. 发起初始请求
    const response = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
        signal: AbortSignal.timeout(60_000),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
        },
        body: JSON.stringify({
            model: model,
            messages: currentMessages,
            tools: openAITools,
            tool_choice: 'auto',
            max_tokens: 4096,
            temperature: 0.7,
            stream: true
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('SiliconFlow 流式API错误:', response.status, errorText);
        throw new Error(`SiliconFlow API 调用失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法获取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    // 用于累积工具调用信息
    let currentToolCalls: any[] = [];
    let isCollectingToolCalls = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;

                    if (!delta) continue;

                    // 处理文本内容
                    if (delta.content) {
                        yield { type: 'text', data: delta.content };
                    }

                    // 处理工具调用
                    if (delta.tool_calls) {
                        isCollectingToolCalls = true;
                        for (const toolCall of delta.tool_calls) {
                            const index = toolCall.index;

                            if (!currentToolCalls[index]) {
                                currentToolCalls[index] = {
                                    id: toolCall.id,
                                    type: toolCall.type,
                                    function: {
                                        name: toolCall.function?.name || '',
                                        arguments: toolCall.function?.arguments || ''
                                    }
                                };
                                // 通知前端开始调用工具
                                if (toolCall.function?.name) {
                                    yield {
                                        type: 'tool_call',
                                        data: { name: toolCall.function.name, status: 'started' }
                                    };
                                }
                            } else {
                                // 追加参数
                                if (toolCall.function?.arguments) {
                                    currentToolCalls[index].function.arguments += toolCall.function.arguments;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // console.error('解析流数据失败', e);
                }
            }
        }
    }

    // 如果收集到了工具调用，需要执行并再次请求
    if (isCollectingToolCalls && currentToolCalls.length > 0) {
        // 1. 将工具调用请求加入历史
        // 注意：流式返回的 tool_calls 需要转换成完整格式
        const toolCallsMsg = currentToolCalls.map(tc => ({
            id: tc.id,
            type: tc.type || 'function',
            function: tc.function
        }));

        currentMessages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCallsMsg
        } as any);

        // 2. 执行工具
        for (const tc of currentToolCalls) {
            const functionName = tc.function.name;
            let functionArgs = {};
            try {
                functionArgs = JSON.parse(tc.function.arguments);
            } catch (e) {
                console.error('解析工具参数失败:', e);
            }

            yield {
                type: 'tool_call',
                data: { name: functionName, status: 'executing' }
            };

            console.log(`[SiliconFlow] 流式执行工具: ${functionName}`);
            const result = await executeTool(functionName, functionArgs);

            yield {
                type: 'tool_result',
                data: { name: functionName, result }
            };

            // 3. 将结果加入历史
            currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result)
            } as any);
        }

        // 4. 发起新的请求 (递归调用)
        // 为了简单起见，这里直接发起一个新的非流式请求流式返回，或者递归调用 chatStream
        // 这里选择递归调用 chatStream，并只返回 text
        // 但要注意递归深度，这里就做一次递归

        console.log('[SiliconFlow] 工具执行完毕，发起后续生成...');

        // 重新发起请求
        const secondResponse = await fetch(`${SILICONFLOW_BASE_URL}/chat/completions`, {
            signal: AbortSignal.timeout(60_000),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: currentMessages,
                tools: openAITools,
                tool_choice: 'auto',
                max_tokens: 4096,
                temperature: 0.7,
                stream: true
            })
        });

        if (secondResponse.ok && secondResponse.body) {
            const reader2 = secondResponse.body.getReader();
            const decoder2 = new TextDecoder();
            let buffer2 = '';

            while (true) {
                const { done, value } = await reader2.read();
                if (done) break;

                buffer2 += decoder2.decode(value, { stream: true });
                const lines = buffer2.split('\n');
                buffer2 = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                yield { type: 'text', data: content };
                            }
                        } catch (e) { }
                    }
                }
            }
        }
    }

    yield { type: 'done', data: '' };
}

// 简单对话（无上下文）
export async function simpleChat(prompt: string, model: string = DEFAULT_MODEL): Promise<string> {
    const response = await chat([{ role: 'user', content: prompt }], model);
    return response.content;
}

// 获取可用模型列表
export function getAvailableModels() {
    return [
        {
            name: 'DeepSeek V3',
            id: AI_MODELS['deepseek-v3'],
            provider: 'siliconflow',
            description: 'DeepSeek V3 - 目前最强开源模型，全能型助手'
        },
        {
            name: 'DeepSeek V3.2 Exp (Pro)',
            id: AI_MODELS['deepseek-v3-pro'],
            provider: 'siliconflow',
            description: 'DeepSeek V3.2 实验版 - 更强推理能力'
        },
        {
            name: 'GLM 4.7 (Pro)',
            id: AI_MODELS['glm-4-plus'],
            provider: 'siliconflow',
            description: '智谱 GLM-4.7 - 中文能力天花板'
        },
        {
            name: 'Kimi K2 Thinking',
            id: AI_MODELS['kimi-k2-thinking'],
            provider: 'siliconflow',
            description: '月之暗面 K2 - 擅长复杂逻辑思考'
        },
        {
            name: 'MiniMax M2',
            id: AI_MODELS['minimax-m2'],
            provider: 'siliconflow',
            description: 'MiniMax M2 - 优秀的创意写作能力'
        },
        {
            name: 'KAT-Dev',
            id: AI_MODELS['kat-dev'],
            provider: 'siliconflow',
            description: '快手 KAT-Dev - 代码与逻辑能力强'
        },
        {
            name: 'Ling 1T',
            id: AI_MODELS['ling-1t'],
            provider: 'siliconflow',
            description: '零一万物 1T - 超大规模通用模型'
        }
    ];
}

// 导出服务
export const siliconflowService = {
    chat,
    chatStream,
    simpleChat,
    getAvailableModels,
    DEFAULT_MODEL,
    AI_MODELS
};

// 保持向后兼容
export const qianwenService = siliconflowService;
