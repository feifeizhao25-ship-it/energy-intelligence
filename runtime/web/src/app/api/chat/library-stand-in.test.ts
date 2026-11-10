jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/ai/quota-guard', () => ({
  requireAiQuota: jest.fn(async () => ({ ok: true, userId: 'u1', plan: 'FREE', remaining: 4 })),
}));
jest.mock('@/lib/assistant/agent', () => ({
  assistantChatStream: async function* () {
    throw new Error('SILICONFLOW_API_KEY 未配置，国内 AI 服务已拒绝生成替代内容');
  },
}));
jest.mock('@/lib/ai/unified', () => ({
  aiService: { getAIProvider: () => 'none', getServiceStatus: () => ({}), getAvailableModels: () => [] },
}));
jest.mock('@/lib/membership/usage', () => ({ logUsage: jest.fn(async () => undefined) }));

import { POST } from './route';
import { clearAnswers } from '@/lib/assistant/answer-store';

beforeEach(() => clearAnswers());

test('模型未配置时，助手流返回资料库来源且不回传密钥', async () => {
  const response = await POST(new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      isAssistant: true,
      messages: [{ role: 'user', content: '新能源上网电价市场化改革 机制电价' }],
    }),
  }) as never);
  expect(response.status).toBe(200);
  const raw = await response.text();
  expect(raw).toContain('未调用模型');
  expect(raw).toContain('ndrc.gov.cn');
  expect(raw).toContain('没有人工复核记录');
  expect(raw).not.toContain('SILICONFLOW');
  expect(raw).not.toContain('API_KEY');
  expect(raw).toContain('"standIn":true');
  expect(raw).toContain('"docx":false');
});
