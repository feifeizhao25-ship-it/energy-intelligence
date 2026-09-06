import { searchArxiv } from './arxiv';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
it('官方无后缀 PDF 链接可用；缺失日期和引用数保持未知', async () => {
 global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => `<feed><entry>
 <id>http://arxiv.org/abs/hep-ex/0307015v1</id><title>Solar paper</title>
 <link type="application/pdf" href="http://arxiv.org/pdf/hep-ex/0307015v1" title="pdf" />
 </entry></feed>` });
 const papers = await searchArxiv('missing-metadata-regression');
 expect(papers[0]).toMatchObject({ year: null, citationCount: null, pdfUrl: 'http://arxiv.org/pdf/hep-ex/0307015v1' });
});
