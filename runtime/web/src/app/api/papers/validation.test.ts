import { NextRequest } from 'next/server';
import { POST as search } from './search/route';
import { POST as ai } from './ai/route';
import { unifiedSearch } from '@/lib/papers/search';
import { generateSummary } from '@/lib/papers/ai';
jest.mock('@/lib/papers/search', () => ({ unifiedSearch: jest.fn() }));
jest.mock('@/lib/papers/ai', () => ({ generateSummary: jest.fn(), extractKeyData: jest.fn(), translateText: jest.fn(), generateFullTranslation: jest.fn() }));
const request = (body: unknown) => new NextRequest('http://localhost/api/papers', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => jest.resetAllMocks());
it.each([null, {}, { query: 23 }, { query: ' ' }, { query: 'x'.repeat(2001) }, { query: '光伏', options: [] }, { query: 'solar', options: { limit: -1 } }, { query: 'solar', options: { yearFrom: 2025, yearTo: 2020 } }, { query: 'solar', options: { openAccess: 'true' } }])('拒绝无效检索参数 %j', async (body) => {
 expect((await search(request(body))).status).toBe(400);
 expect(unifiedSearch).not.toHaveBeenCalled();
});
it('错误的 JSON 返回输入错误', async () => {
 expect((await search(new NextRequest('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
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
