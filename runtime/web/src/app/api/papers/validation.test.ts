import { NextRequest } from 'next/server';
import { POST as search } from './search/route';
import { POST as ai } from './ai/route';
import { unifiedSearch } from '@/lib/papers/search';
import { generateSummary } from '@/lib/papers/ai';
jest.mock('@/lib/ai/quota-guard', () => ({ requireAiQuota: jest.fn() }));
import { requireAiQuota } from '@/lib/ai/quota-guard';
jest.mock('@/lib/membership/middleware', () => ({ acquireMember: jest.fn() }));
import { acquireMember } from '@/lib/membership/middleware';
jest.mock('@/lib/papers/search', () => ({ unifiedSearch: jest.fn() }));
jest.mock('@/lib/papers/ai', () => ({ generateSummary: jest.fn(), extractKeyData: jest.fn(), translateText: jest.fn(), generateFullTranslation: jest.fn() }));
const request = (body: unknown) => new NextRequest('http://localhost/api/papers', { method: 'POST', body: JSON.stringify(body) });
const refund = jest.fn(async () => undefined);
beforeEach(() => {
 jest.resetAllMocks();
 jest.mocked(requireAiQuota).mockResolvedValue({ ok: true, userId: 'u1', plan: 'PRO', remaining: 10 });
 jest.mocked(acquireMember).mockResolvedValue({ ok: true, user: { id: 'u1', plan: 'PRO' as never }, refund });
});
it.each([null, {}, { query: 23 }, { query: ' ' }, { query: 'x'.repeat(2001) }, { query: '光伏', options: [] }, { query: 'solar', options: { limit: -1 } }, { query: 'solar', options: { yearFrom: 2025, yearTo: 2020 } }, { query: 'solar', options: { openAccess: 'true' } }])('拒绝无效检索参数 %j', async (body) => {
 expect((await search(request(body))).status).toBe(400);
 expect(unifiedSearch).not.toHaveBeenCalled();
});
it('错误的 JSON 返回输入错误', async () => {
 expect((await search(new NextRequest('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
});
it('未登录不能检索，也不会触发任何上游/模型调用', async () => {
 const { NextResponse } = await import('next/server');
 jest.mocked(acquireMember).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 }) });
 const res = await search(request({ query: '光伏' }));
 expect(res.status).toBe(401);
 expect(unifiedSearch).not.toHaveBeenCalled();
});
it('每日检索次数用完：429，不调用上游；检索按「文献检索」额度扣减', async () => {
 const { NextResponse } = await import('next/server');
 jest.mocked(acquireMember).mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'USAGE_LIMIT_EXCEEDED', message: '今日文献检索次数已用完（3 次），请升级会员或等待明日 0 点重置' }, { status: 429 }) });
 expect((await search(request({ query: '光伏' }))).status).toBe(429);
 expect(acquireMember).toHaveBeenCalledWith({ usageType: 'paper_search' });
 expect(unifiedSearch).not.toHaveBeenCalled();
});
it('上游失败时退还已扣的检索次数', async () => {
 jest.mocked(unifiedSearch).mockRejectedValue(new Error('x'));
 await search(request({ query: '光伏' }));
 expect(refund).toHaveBeenCalledTimes(1);
});
it('检索故障不泄漏上游异常', async () => {
 jest.mocked(unifiedSearch).mockRejectedValue(new Error('secret upstream token'));
 const response = await search(request({ query: '光伏' }));
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({ error: '学术数据源暂时不可用，请稍后重试', code: 'UPSTREAM_UNAVAILABLE' });
});
it.each([{}, null, { action: 'invalid', text: '文章' }, { action: 'summary', text: ' ' }, { action: 'summary', text: 123 }])('无效文献处理不调用模型 %j', async body => {
 expect((await ai(request(body))).status).toBe(400);
 expect(generateSummary).not.toHaveBeenCalled();
});
it('处理故障返回可理解的中文', async () => {
 jest.mocked(generateSummary).mockRejectedValue(new Error('secret'));
 const response = await ai(request({ action: 'summary', text: '文章' }));
 expect(response.status).toBe(503);
 expect((await response.json()).error).toBe('文献处理服务暂时不可用，请稍后重试');
});
