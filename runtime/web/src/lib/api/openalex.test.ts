import { searchOpenAlex } from './openalex';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); delete process.env.OPENALEX_API_KEY; });
it('从开放获取位置读取 PDF，支持缺失作者和可选密钥', async () => {
 process.env.OPENALEX_API_KEY = 'test-key';
 global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{
  id: 'https://openalex.org/W1', title: 'Solar', publication_year: 2026,
  cited_by_count: 0, best_oa_location: { is_oa: true, pdf_url: 'https://example.org/paper.pdf' }
 }] }) });
 const papers = await searchOpenAlex('solar');
 expect(papers[0]).toMatchObject({ authors: [], pdfUrl: 'https://example.org/paper.pdf', citationCount: 0 });
 expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
  headers: expect.objectContaining({ Authorization: 'Bearer test-key' }), signal: expect.any(AbortSignal)
 }));
});
it('损坏的数据源响应不能冒充空结果', async () => {
 jest.spyOn(console, 'error').mockImplementation(() => {});
 global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
 await expect(searchOpenAlex('solar')).rejects.toThrow('数据暂时不可用');
});
