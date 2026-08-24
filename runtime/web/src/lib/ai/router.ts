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
const openRouterKey = process.env.OPENROUTER_API_KEY;

/**
 * 统一 AI 路由服务
 * 优先使用 SiliconFlow 接入国产模型，支持自动备选切换
 */
export async function callAI(req: AIRequest) {
    if (openRouterKey) {
        const primary = process.env.OPENROUTER_MODEL_QUALITY || 'deepseek/deepseek-v3.2';
        const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || 'qwen/qwen3-30b-a3b-instruct-2507,google/gemini-2.5-flash').split(',').map(item => item.trim()).filter(Boolean);
        const client = new OpenAI({ apiKey: openRouterKey, baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', defaultHeaders: { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://xinnengyuan.ai', 'X-Title': '新能源智库' } });
        return client.chat.completions.create({
            model: primary,
            messages: req.messages,
            temperature: req.temperature ?? 0.4,
            max_tokens: Math.min(4096, Math.max(1, req.max_tokens || 2000)),
            stream: req.stream || false,
            tools: req.tools,
            tool_choice: req.tool_choice,
        }, { body: { models: [primary, ...fallbacks], provider: { data_collection: 'deny', zdr: true, require_parameters: true } } });
    }
    const model = req.model || 'glm-4-plus';

    if (!siliconFlowKey) {
        throw new Error('OPENROUTER_API_KEY 或 SILICONFLOW_API_KEY 未配置，AI 服务已拒绝生成替代内容');
    }

    const client = new OpenAI({
        apiKey: siliconFlowKey,
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
    if (!siliconFlowKey) {
        throw new Error('SILICONFLOW_API_KEY 未配置，向量服务已拒绝生成替代向量');
    }

    const client = new OpenAI({
        apiKey: siliconFlowKey,
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
        // 旧内部标识在 SiliconFlow 路径映射到可用的通用质量模型；
        // OpenRouter 路径由 OPENROUTER_MODEL_QUALITY 统一选型。
        'claude-sonnet': 'Pro/zai-org/GLM-4.7'
    };
    return mapping[model] || mapping['glm-4-plus'];
}
