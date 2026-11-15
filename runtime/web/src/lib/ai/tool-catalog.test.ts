import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AI_TOOLS } from '@/lib/ai/tools';
import { assistantToolDefinitions } from '@/lib/assistant/tools';
import {
    ASSISTANT_AGENT_TOOLS,
    CN_MODEL_TOOLS,
    INTERNAL_EXECUTOR_TOOLS,
    SILICONFLOW_CHAT_TOOLS,
    modelToolNames,
} from '@/lib/ai/tool-catalog';

function executorCases(): string[] {
    const source = readFileSync(join(__dirname, 'tool-executor.ts'), 'utf8');
    const start = source.indexOf('export async function executeTool');
    const end = source.indexOf('// ========== 辅助函数');
    const body = source.slice(start, end);
    return [...body.matchAll(/case '([^']+)':/g)].map((match) => match[1]);
}

describe('工具名只有一份目录', () => {
    it('声明给模型的工具都有执行分支，执行分支也都在目录里', () => {
        const declared = new Set<string>([
            ...SILICONFLOW_CHAT_TOOLS,
            ...ASSISTANT_AGENT_TOOLS,
            ...INTERNAL_EXECUTOR_TOOLS,
        ]);
        const cases = executorCases();
        const caseSet = new Set(cases);
        expect(cases).toHaveLength(caseSet.size);
        expect([...declared].filter((name) => !caseSet.has(name))).toEqual([]);
        expect(cases.filter((name) => !declared.has(name))).toEqual([]);
        expect(declared.size).toBe(cases.length);
    });

    it('tools.ts 与助手定义和目录一致，国内模型调用不附带工具', () => {
        expect(Object.values(AI_TOOLS).map((tool) => tool.name).sort()).toEqual([...SILICONFLOW_CHAT_TOOLS].sort());
        expect(assistantToolDefinitions.map((tool) => tool.function.name).sort()).toEqual([...ASSISTANT_AGENT_TOOLS].sort());
        expect(modelToolNames('cn', 'chat')).toEqual(CN_MODEL_TOOLS);
        expect(modelToolNames('cn', 'assistant')).toEqual([]);
        expect(modelToolNames('global', 'chat')).toEqual(SILICONFLOW_CHAT_TOOLS);
        expect(modelToolNames('global', 'assistant')).toEqual(ASSISTANT_AGENT_TOOLS);
        expect(CN_MODEL_TOOLS).toHaveLength(0);
    });

    it('国内聊天不把工具目录传给模型，国际聊天和助手按目录传递', () => {
        const qianwen = readFileSync(join(__dirname, 'qianwen.ts'), 'utf8');
        const agent = readFileSync(join(__dirname, '../assistant/agent.ts'), 'utf8');
        const router = readFileSync(join(__dirname, 'router.ts'), 'utf8');
        expect(qianwen).toContain("modelToolNames(isCnEdition() ? 'cn' : 'global', 'chat')");
        expect(qianwen).not.toContain('convertToOpenAITools(AI_TOOLS)');
        expect(agent).toContain("modelToolNames(isCnEdition() ? 'cn' : 'global', 'assistant')");
        const domestic = router.slice(router.indexOf('async function callDomesticBackend'), router.indexOf('export async function callAI'));
        expect(domestic).toContain('messages: req.messages');
        expect(domestic).not.toContain('tools');
    });
});
