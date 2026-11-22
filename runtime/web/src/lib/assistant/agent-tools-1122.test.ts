jest.mock('@/lib/ai/router', () => ({ callAI: jest.fn(), isCnEdition: () => true }));
jest.mock('@/lib/assistant/tools', () => ({
  assistantToolDefinitions: [{ type: 'function', function: { name: 'query_knowledge_base', parameters: { type: 'object' } } }],
  handleToolCall: jest.fn(async () => ({ context: '[S1] 原文', sources: [{ title: '规范', url: 'https://gov.test/doc' }] })),
}));
import { callAI } from '@/lib/ai/router';
import { handleToolCall } from '@/lib/assistant/tools';
import { assistantChatStream } from './agent';

test('国内助手：模型先调 query_knowledge_base，带结果再问，最后回答有 [S1]，无伪标签', async () => {
  const ai = callAI as jest.Mock;
  ai.mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'query_knowledge_base', arguments: '{"query":"GB50797"}' } }] } }] });
  ai.mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: '<ds_safety>内部</ds_safety>原文规定如下 [S1]。' } }] });
  const events = [];
  for await (const event of assistantChatStream([{ role: 'user', content: 'GB50797？' }], 'deepseek-flash', 'u1')) events.push(event);
  expect(ai.mock.calls[0][0].tools.map((t: any) => t.function.name)).toEqual(['query_knowledge_base']);
  expect(handleToolCall).toHaveBeenCalledWith('query_knowledge_base', '{"query":"GB50797"}', 'u1');
  expect(ai.mock.calls[1][0].messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
  expect(events.map(e => e.type)).toEqual(['tool_call', 'tool_result', 'text']);
  expect(events.at(-1)?.data).toBe('原文规定如下 [S1]。');
});
