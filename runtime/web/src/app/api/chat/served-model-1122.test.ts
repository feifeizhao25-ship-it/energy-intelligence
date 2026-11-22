jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/ai/quota-guard', () => {
  const refundAiCall = jest.fn(async () => undefined);
  return {
    requireAiQuota: jest.fn(async () => ({ ok: true, userId: 'u1', plan: 'FREE', remaining: 4 })),
    refundAiCall,
    trackAiQuota: (userId: string) => {
      let closed = false;
      return {
        settle() { closed = true; },
        async refund() {
          if (closed) return;
          closed = true;
          await refundAiCall(userId);
        },
      };
    },
  };
});
var assistantStream: () => AsyncGenerator<{ type: string; data: unknown }> = async function* () {
  throw new Error('SILICONFLOW_API_KEY 未配置，国内 AI 服务已拒绝生成替代内容');
};
jest.mock('@/lib/assistant/agent', () => ({
  assistantChatStream: () => assistantStream(),
}));
jest.mock('@/lib/ai/unified', () => ({
  aiService: { getAIProvider: () => 'none', getServiceStatus: () => ({}), getAvailableModels: () => [] },
}));
jest.mock('@/lib/membership/usage', () => ({ logUsage: jest.fn(async () => undefined) }));

import { POST } from './route';

import { POST } from './route';
import { clearAnswers, readAnswer } from '@/lib/assistant/answer-store';

/**
 * 2026-11-21 测试：界面和 AIGC 标注写「模型 glm-4-flash」，实际出答的是 deepseek-flash。
 * 现在以模型返回的型号为准：回答正文之前再发一次 provider 事件，存档和导出也记实际型号。
 */
beforeEach(() => {
  clearAnswers();
  assistantStream = async function* () {
    yield { type: 'model', data: { model: 'deepseek-flash', provider: 'deepseek' } };
    yield { type: 'text', data: '工商业储能有三种常见商业模式。' };
  };
});

function events(raw: string) {
  return raw.split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').map((l) => JSON.parse(l.slice(6)));
}

test('served model replaces the plan default before the answer text, and is stored for export', async () => {
  const response = await POST(new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isAssistant: true, messages: [{ role: 'user', content: '工商业储能有哪些商业模式' }] }),
  }) as never);
  const list = events(await response.text());
  const providers = list.filter((e) => e.type === 'provider');
  const contentAt = list.findIndex((e) => e.type === 'content');
  const lastProviderAt = list.map((e) => e.type).lastIndexOf('provider');
  expect(providers[providers.length - 1].data.model).toBe('deepseek-flash');
  expect(providers[providers.length - 1].data.aigc.model).toBe('deepseek-flash');
  expect(lastProviderAt).toBeLessThan(contentAt);
  const evidence = list.find((e) => e.type === 'evidence');
  expect(readAnswer(evidence.data.answerId)?.model).toBe('deepseek-flash');
});

test('the assistant system prompt no longer claims a model', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../../lib/assistant/agent.ts'), 'utf8');
  expect(src).not.toMatch(/使用模型：/);
  expect(src).toContain("type: 'model'");
});
