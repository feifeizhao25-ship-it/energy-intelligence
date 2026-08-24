import { Message } from "@/types";
import { callAI } from "@/lib/ai/router";
import { assistantToolDefinitions, handleToolCall } from "./tools";

/**
 * 能源智库 Agent 核心逻辑
 * 支持多轮工具调用，直到给出最终回答
 */
export async function* assistantChatStream(
    messages: Message[],
    model: string = 'glm-4-plus',
    userId?: string
): AsyncGenerator<{ type: string; data: any }> {

    const MAX_ITERATIONS = 5;
    let currentMessages = [...messages];
    let iteration = 0;

    // 1. 系统提示词增强
    if (currentMessages[0].role !== 'system') {
        currentMessages.unshift({
            role: 'system',
            content: `你是一个专业的新能源智库专家助手。
      你可以调用专业工具来获取实时日照数据、执行复杂的经济测算、检索学术论文。
      特别注意：当用户询问关于"我上传的论文"、"我的知识库"或具体的论文细节时，**必须**优先调用 query_knowledge_base 工具进行检索，而不是仅凭训练数据回答。
      当用户询问具体地点的资源、项目收益或技术问题时，请优先考虑调用工具获取准确数据，而非模糊回答。
      当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
      使用模型：GLM-4.7 Pro (硅基流动)
      `
        });
    }

    while (iteration < MAX_ITERATIONS) {
        iteration++;

        // @ts-ignore
        const response = await callAI({
            model: model as any, // 推荐使用 GLM-4 或 DeepSeek V3 进行工具调用
            messages: currentMessages,
            tools: assistantToolDefinitions,
            tool_choice: 'auto'
        }) as any;

        const message = response.choices[0].message;

        // 如果没有工具调用，说明是最终回答（或中间状态），直接返回并退出
        if (!message.tool_calls || message.tool_calls.length === 0) {
            yield { type: 'text', data: message.content };
            return;
        }

        // 处理工具调用
        currentMessages.push(message); // 将模型的“调用意图”加入对话历史

        for (const toolCall of message.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;

            // 发送状态给前端
            yield { type: 'tool_call', data: { name: toolName, args: toolArgs } };

            try {
                const result = await handleToolCall(toolName, toolArgs, userId);

                // 发送结果给前端（可选，用于展示中间过程）
                yield { type: 'tool_result', data: { name: toolName, result } };

                // 将工具执行结果加入对话历史
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    // @ts-ignore
                    name: toolName,
                    content: JSON.stringify(result)
                });
            } catch (err: any) {
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    // @ts-ignore
                    name: toolName,
                    content: `Error: ${err.message}`
                });
            }
        }

        // 继续下一轮迭代，让 AI 根据工具结果生成最终回复
    }

    yield { type: 'text', data: "抱歉，由于逻辑过于复杂，我无法通过一次对话完成所有测算。" };
}
