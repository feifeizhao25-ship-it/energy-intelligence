import OpenAI from "openai";

export type AIModel =
    | 'glm-4-plus'
    | 'glm-4-flash'
    | 'kimi-v1'
    | 'minimax-abab6.5'
    | 'deepseek-v3'
    | 'deepseek-chat'
    | 'deepseek-flash'
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

export function isCnEdition(): boolean {
    return (process.env.NEXT_PUBLIC_APP_EDITION || process.env.APP_EDITION || '').toLowerCase() === 'cn';
}

/** glm-4-flash 对应智谱文档中的 glm-4.7-flash。deepseek-flash 保持原模型号。 */
export function cnRequestModel(model?: string): string {
    if (!model || model === 'deepseek-flash') return 'deepseek-flash';
    if (model === 'glm-4-flash' || model === 'glm-4.7-flash') return 'glm-4.7-flash';
    return model;
}

async function callDomesticBackend(req: AIRequest) {
    const base = (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
    const token = process.env.NENGJIAN_INTERNAL_TOKEN || '';
    const development = process.env.NODE_ENV === 'development';
    if (!base || (!token && !development)) {
        throw new Error('国内 AI 服务已拒绝生成替代内容');
    }
    const response = await fetch(`${base}/api/v1/ai/domestic`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Internal-Token': token } : {}),
        },
        body: JSON.stringify({
            model: cnRequestModel(req.model),
            messages: req.messages,
        }),
    });
    if (!response.ok) {
        throw new Error('国内 AI 服务已拒绝生成替代内容');
    }
    const data = await response.json();
    return {
        choices: [{ message: { role: 'assistant', content: data.content || '' } }],
        model: data.model,
        provider: data.provider,
    };
}

/**
 * 统一 AI 路由服务
 * 国内版走后端 DeepSeek → 百炼 → 智谱。其他环境仍可使用 SiliconFlow。
 */
export async function callAI(req: AIRequest) {
    if (isCnEdition()) return callDomesticBackend(req);
    const model = req.model || 'glm-4-plus';

    if (!siliconFlowKey) {
        throw new Error('SILICONFLOW_API_KEY 未配置，国内 AI 服务已拒绝生成替代内容');
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
            max_tokens: Math.min(4096, Math.max(1, req.max_tokens || 2000)),
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
    if (isCnEdition()) {
        const base = (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
        const token = process.env.NENGJIAN_INTERNAL_TOKEN || '';
        if (!base || (!token && process.env.NODE_ENV !== 'development')) {
            throw new Error('向量服务已拒绝生成替代向量');
        }
        const response = await fetch(`${base}/api/v1/ai/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Internal-Token': token } : {}) },
            body: JSON.stringify({ input: Array.isArray(input) ? input : [input] }),
        });
        if (!response.ok) throw new Error('向量服务已拒绝生成替代向量');
        const data = await response.json();
        if (!Array.isArray(data.vectors) || !data.vectors.length) throw new Error('向量服务已拒绝生成替代向量');
        return data.vectors as number[][];
    }
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
        'kimi-v1': 'deepseek-ai/DeepSeek-V3',
        'moonshot-v1-auto': 'deepseek-ai/DeepSeek-V3',
        // 使用 Qwen3 VL 32B Thinking 模型（支持视觉）
        'minimax-abab6.5': 'Qwen/Qwen3-VL-32B-Thinking',
        // DeepSeek V3 保持原样
        'deepseek-v3': 'deepseek-ai/DeepSeek-V3',
        'deepseek-chat': 'deepseek-ai/DeepSeek-V3',
        'deepseek-flash': 'deepseek-flash',
        // 旧内部标识在非国内版的 SiliconFlow 路径映射到可用模型。
        // 国内版在 callAI 开头转到后端国内路由，不使用这里的映射。
        'claude-sonnet': 'deepseek-ai/DeepSeek-V3'
    };
    return mapping[model] || mapping['glm-4-plus'];
}
