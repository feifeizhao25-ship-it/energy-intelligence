const session: { user: { id: string } | null } = { user: { id: 'owner' } };
let user: { plan: string; planExpireAt: Date | null } = { plan: 'FREE', planExpireAt: null };
const consumeQuota = jest.fn(async () => ({ success: true, usage: { used: 1, limit: 3, exceeded: false } }));

jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => session.user ? session : null) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/audit/quota', () => ({ consumeQuota: (...args: unknown[]) => consumeQuota(...args) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(async () => user) } } }));

import { POST } from './route';
import { clearAnswers, saveAnswer } from '@/lib/assistant/answer-store';

const call = (id: string, body: unknown) => POST(new Request('http://x/export', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}), { params: Promise.resolve({ id }) });

beforeEach(() => {
  clearAnswers();
  consumeQuota.mockClear();
  session.user = { id: 'owner' };
  user = { plan: 'FREE', planExpireAt: null };
  consumeQuota.mockResolvedValue({ success: true, usage: { used: 1, limit: 3, exceeded: false } });
});

test('免费版拒绝 Word，不扣额度', async () => {
  const saved = saveAnswer({
    userId: 'owner', text: '未调用模型。', sources: [{ title: '136号文', url: 'https://www.ndrc.gov.cn/a' }], standIn: true, synthetic: false,
  });
  const response = await call(saved.id, { format: 'docx' });
  expect(response.status).toBe(403);
  expect((await response.json()).message).toContain('当前套餐不含 Word 导出');
  expect(consumeQuota).not.toHaveBeenCalled();
});

test('额度用尽返回报告导出提示', async () => {
  consumeQuota.mockResolvedValue({ success: false, usage: { used: 3, limit: 3, exceeded: true } });
  const saved = saveAnswer({
    userId: 'owner', text: '未调用模型。', sources: [{ title: '136号文', url: 'https://www.ndrc.gov.cn/a' }], standIn: true, synthetic: false,
  });
  const response = await call(saved.id, { format: 'pdf' });
  expect(response.status).toBe(429);
  expect((await response.json()).message).toContain('本月报告导出额度已用尽');
});

test('其他用户不能下载这条回答', async () => {
  const saved = saveAnswer({
    userId: 'owner', text: '未调用模型。', sources: [{ title: '136号文', url: 'https://www.ndrc.gov.cn/a' }], standIn: true, synthetic: false,
  });
  session.user = { id: 'other' };
  const response = await call(saved.id, { format: 'pdf' });
  expect(response.status).toBe(404);
  expect((await response.json()).message).toBe('回答不存在或无权访问');
  expect(consumeQuota).not.toHaveBeenCalled();
});

test('文件只含已保存的来源，忽略请求体里的标题', async () => {
  user = { plan: 'PRO', planExpireAt: new Date(Date.now() + 86400e3) };
  const saved = saveAnswer({
    userId: 'owner',
    text: '未调用模型。下面只列资料库命中，不是模型结论。',
    sources: [{ title: '发改价格〔2025〕136号', url: 'https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html', locator: '机制电价' }],
    standIn: true,
    synthetic: false,
  });
  const response = await call(saved.id, { format: 'docx', title: 'FAKE SOURCE', sources: [{ title: 'FAKE SOURCE' }] });
  expect(response.status).toBe(200);
  const xml = Buffer.from(await response.arrayBuffer()).toString('utf8');
  expect(xml).toContain('发改价格〔2025〕136号');
  expect(xml).toContain('ndrc.gov.cn');
  expect(xml).toContain('w:hyperlink');
  expect(xml).toContain('TargetMode="External"');
  expect(xml).toContain('不是经人工签字');
  expect(xml).not.toContain('FAKE SOURCE');
});
