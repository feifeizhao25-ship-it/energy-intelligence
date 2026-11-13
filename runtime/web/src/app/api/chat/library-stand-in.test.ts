jest.mock('next-auth/next', () => ({ getServerSession: jest.fn(async () => ({ user: { id: 'u1' } })) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/ai/quota-guard', () => ({
  requireAiQuota: jest.fn(async () => ({ ok: true, userId: 'u1', plan: 'FREE', remaining: 4 })),
  refundAiCall: jest.fn(async () => undefined),
}));
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
import { clearAnswers } from '@/lib/assistant/answer-store';
import { refundAiCall } from '@/lib/ai/quota-guard';

const refund = refundAiCall as jest.Mock;

beforeEach(() => {
  clearAnswers();
  refund.mockClear();
  assistantStream = async function* () {
    throw new Error('SILICONFLOW_API_KEY 未配置，国内 AI 服务已拒绝生成替代内容');
  };
});

function post(content: string) {
  return POST(new Request('http://x/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ isAssistant: true, messages: [{ role: 'user', content }] }),
  }) as never);
}

test('模型未配置时，助手流返回资料库来源且不回传密钥', async () => {
  const response = await post('新能源上网电价市场化改革 机制电价');
  expect(response.status).toBe(200);
  const raw = await response.text();
  expect(raw).toContain('未调用模型');
  expect(raw).toContain('ndrc.gov.cn');
  expect(raw).toContain('发文日期');
  expect(raw).toContain('没有人工复核记录');
  expect(raw).not.toContain('SILICONFLOW');
  expect(raw).not.toContain('API_KEY');
  expect(raw).not.toContain('未知错误');
  expect(raw).toContain('"standIn":true');
  expect(raw).toContain('"docx":false');
  expect(refund).toHaveBeenCalledWith('u1');
});

test('国内模型后端连不上时，有资料库命中就返回同样的资料库回答，并且不扣次数', async () => {
  assistantStream = async function* () {
    const error = new TypeError('fetch failed');
    (error as { cause?: unknown }).cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), { code: 'ECONNREFUSED' });
    throw error;
  };
  const response = await post('光伏发电站设计标准');
  expect(response.status).toBe(200);
  const raw = await response.text();
  expect(raw).toContain('未调用模型');
  expect(raw).toContain('发文日期：2024-03-01');
  expect(raw).toContain('光伏发电站设计标准');
  expect(raw).toContain('"standIn":true');
  expect(raw).not.toContain('未知错误');
  expect(raw).not.toContain('ECONNREFUSED');
  expect(raw).not.toContain('fetch failed');
  expect(refund).toHaveBeenCalledTimes(1);
  expect(refund).toHaveBeenCalledWith('u1');
});

test('国内模型后端连不上且资料库没有命中时，提示暂时连不上，不写未知错误', async () => {
  assistantStream = async function* () {
    throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8000'), { code: 'ECONNREFUSED' });
  };
  const response = await post('虚构县 ZZQQ-999 的区划罚则');
  const raw = await response.text();
  expect(raw).toContain('智能助手暂时连不上，请稍后再试');
  expect(raw).not.toContain('未知错误');
  expect(raw).not.toContain('ECONNREFUSED');
  expect(raw).not.toContain('"standIn":true');
  expect(refund).toHaveBeenCalledWith('u1');
});

test('模型正常回答时不退还次数', async () => {
  assistantStream = async function* () {
    yield { type: 'text', data: '按已收录标准复述，不另作结论。' };
  };
  const response = await post('光伏发电站设计标准');
  const raw = await response.text();
  expect(raw).toContain('按已收录标准复述，不另作结论。');
  expect(raw).not.toContain('未知错误');
  expect(raw).toContain('"standIn":false');
  expect(refund).not.toHaveBeenCalled();
});
