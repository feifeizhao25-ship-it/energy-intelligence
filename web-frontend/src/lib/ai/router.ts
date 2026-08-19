import OpenAI from "openai";

export type AIModel =
    | 'glm-4-plus'
    | 'glm-4-flash'
    | 'kimi-v1'
    | 'minimax-abab6.5'
    | 'deepseek-v3'
    | 'deepseek-chat'
    | 'moonshot-v1-auto'
    | 'claude-sonnet';

export interface AIRequest {
    model?: AIModel;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: any[];
    tool_choice?: any;
}

const siliconFlowKey = process.env.SILICONFLOW_API_KEY;

/**
 * 统一 AI 路由服务
 * 优先使用 SiliconFlow 接入国产模型，支持自动备选切换
 */
export async function callAI(req: AIRequest) {
    const model = req.model || 'glm-4-plus';

    // 如果没有配置 SiliconFlow，开发环境下模拟返回
    if (!siliconFlowKey && process.env.NODE_ENV === 'development') {
        console.log(`[AI MOCK] Calling ${model} with ${req.messages.length} messages`);
        if (req.stream) {
            // 返回一个简单的模拟流
            return mockStreamResponse(model);
        }
        return mockResponse(model, req);
    }

    const client = new OpenAI({
        apiKey: siliconFlowKey || 'mock-key',
        baseURL: "https://api.siliconflow.cn/v1",
    });

    try {
        const response = await client.chat.completions.create({
            model: getModelMapping(model),
            messages: req.messages,
            temperature: req.temperature || 0.7,
            max_tokens: req.max_tokens || 2000,
            stream: req.stream || false,
            tools: req.tools,
            tool_choice: req.tool_choice,
        });

        return response;
    } catch (error: any) {
        console.error(`AI Router Error (${model}):`, error);

        // 如果是流式请求失败，可能较难自动 fallback，直接抛出
        if (req.stream) throw error;

        // 非流式请求尝试使用 deepseek 作为 fallback
        if (model !== 'deepseek-v3' && !req.stream) {
            console.log("Falling back to deepseek-v3...");
            return callAI({ ...req, model: 'deepseek-v3' });
        }

        throw error;
    }
}

/**
 * 生成文本向量 (Embeddings)
 * 使用 BAAI/bge-m3 模型，支持 1024 维向量
 */
export async function createEmbedding(input: string | string[]) {
    // 模拟环境
    if (!siliconFlowKey && process.env.NODE_ENV === 'development') {
        const mockVector = new Array(1024).fill(0).map(() => Math.random());
        return Array.isArray(input) ? input.map(() => mockVector) : [mockVector];
    }

    const client = new OpenAI({
        apiKey: siliconFlowKey || 'mock-key',
        baseURL: "https://api.siliconflow.cn/v1",
    });

    const response = await client.embeddings.create({
        model: "BAAI/bge-m3",
        input: input,
    });

    return response.data.map(d => d.embedding);
}

/**
 * 将内部模型标识映射为服务商标识
 * 使用硅基流动提供的高级模型
 */
function getModelMapping(model: AIModel): string {
    const mapping: Record<AIModel, string> = {
        // 使用硅基流动的 GLM-4.7 Pro 模型
        'glm-4-plus': 'Pro/zai-org/GLM-4.7',
        'glm-4-flash': 'Pro/zai-org/GLM-4.7',
        // 使用 Kimi K2 Thinking 模型
        'kimi-v1': 'Pro/moonshotai/Kimi-K2-Thinking',
        'moonshot-v1-auto': 'Pro/moonshotai/Kimi-K2-Thinking',
        // 使用 Qwen3 VL 32B Thinking 模型（支持视觉）
        'minimax-abab6.5': 'Qwen/Qwen3-VL-32B-Thinking',
        // DeepSeek V3 保持原样
        'deepseek-v3': 'deepseek-ai/DeepSeek-V3',
        'deepseek-chat': 'deepseek-ai/DeepSeek-V3',
        // Claude 使用 OpenRouter（如果配置）
        'claude-sonnet': 'anthropic/claude-3.5-sonnet'
    };
    return mapping[model] || mapping['glm-4-plus'];
}

/**
 * 开发环境模拟响应
 */
async function mockResponse(model: string, req?: AIRequest) {
    await new Promise(resolve => setTimeout(resolve, 800));

    let content = `[这是来自 ${model} 的演示响应] 该光伏项目的年度等效利用小时数预计为 1250 小时，建议关注 3-5 月的辐照度波动。`;

    // 智能 Mock：根据 Prompt 内容返回符合格式的数据
    const lastMsg = req?.messages?.[req.messages.length - 1]?.content || '';
    console.log('[MockDebug] Last Msg Preview:', lastMsg.substring(0, 100));

    if (lastMsg.toLowerCase().includes('json')) {
        let jsonContent = '[]';

        if (lastMsg.includes('翻译') || lastMsg.includes('translation')) {
            // 尝试提取原文中的标题和摘要，使 Mock 更真实
            let mockTitle = "Sample Title";
            let mockAbstract = "Sample Abstract";

            try {
                const titleMatch = lastMsg.match(/Title:\s*([^\n]+)/);
                if (titleMatch) mockTitle = titleMatch[1].trim();

                const abstractMatch = lastMsg.match(/Abstract:\s*([^\n]+)/);
                if (abstractMatch) mockAbstract = abstractMatch[1].trim().substring(0, 100) + "...";
            } catch (e) {
                console.error('[Mock] Extraction failed', e);
            }

            jsonContent = JSON.stringify([
                { "section": "标题", "en": mockTitle, "zh": `${mockTitle} (中文译本)` },
                { "section": "摘要", "en": mockAbstract, "zh": "（此处为系统自动生成的模拟翻译结果，用于演示界面布局。由于处于演示模式，未调用真实翻译API。）" },
                { "section": "研究结论", "en": "The study concludes that the proposed method is effective.", "zh": "研究表明，该方法在特定条件下具有显著优势，可提升系统效率约 15%。" }
            ]);
        } else if (lastMsg.includes('extract') || lastMsg.includes('提取')) {
            jsonContent = JSON.stringify([
                { "label": "演示效率", "value": "24.5%", "context": "实验室测试效率" },
                { "label": "成本降低", "value": "12%", "context": "与传统工艺相比" }
            ]);
        } else {
            // Default JSON fallback
            jsonContent = JSON.stringify({ "note": "Mock JSON response" });
        }

        content = jsonContent;
    } else if (lastMsg.includes('结构化的中文摘要') || lastMsg.includes('structure')) {
        content = `### 研究背景
本文针对新能源领域的核心问题进行了深入探讨，特别是在光伏/风电的效率优化方面。

### 主要方法
研究团队采用了基于深度学习的预测模型，结合了过去5年的气象数据与实地测试结果。

### 核心结论
1. 提出的新算法将预测精度提升了 15%。
2. 系统在极端天气下的稳定性提高了 20%。
3. 成本分析显示，该方案具有显著的经济效益。

### 实际意义
该研究为未来的智能电网调度提供了重要的理论依据和技术支持。`;
    }

    return {
        id: 'mock-id',
        object: 'chat.completion',
        created: Date.now(),
        model: model,
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: content
                },
                finish_reason: 'stop'
            }
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    };
}

/**
 * 模拟流式生成
 */
async function* mockStreamResponse(model: string) {
    const content = `[AI 助手 ${model}] 正在为您计算... 结果显示该区域风速分布均匀，适合安装 5MW 级别机组。`;
    const words = content.split(' ');
    for (const word of words) {
        await new Promise(resolve => setTimeout(resolve, 100));
        yield {
            choices: [{
                delta: { content: word + ' ' },
                finish_reason: null
            }]
        };
    }
}
