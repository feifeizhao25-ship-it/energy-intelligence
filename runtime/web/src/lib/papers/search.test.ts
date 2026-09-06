import { unifiedSearch } from './search';
import { searchPapers } from '../api/semantic-scholar';
import { searchArxiv } from '../api/arxiv';
import { searchOpenAlex } from '../api/openalex';
jest.mock('../api/semantic-scholar', () => ({ searchPapers: jest.fn() }));
jest.mock('../api/arxiv', () => ({ searchArxiv: jest.fn() }));
jest.mock('../api/openalex', () => ({ searchOpenAlex: jest.fn() }));
jest.mock('../ai/unified', () => ({ simpleChat: jest.fn() }));
it('不同中文标题不会合并；相同标题忽略空格后去重', async () => {
 jest.mocked(searchPapers).mockResolvedValue({ total: 1, papers: [{ title: '光伏发电研究' }] } as any);
 jest.mocked(searchOpenAlex).mockResolvedValue([{ title: '储能技术研究' }, { title: '光伏 发电研究' }] as any);
 jest.mocked(searchArxiv).mockResolvedValue([]);
 const result = await unifiedSearch('solar');
 expect(result.papers.map(p => p.title)).toEqual(['光伏发电研究', '储能技术研究']);
});
it('所有数据源失败时不伪造无结果', async () => {
 jest.mocked(searchPapers).mockRejectedValue(new Error('offline'));
 jest.mocked(searchOpenAlex).mockRejectedValue(new Error('offline'));
 jest.mocked(searchArxiv).mockRejectedValue(new Error('offline'));
 await expect(unifiedSearch('solar')).rejects.toThrow('全部学术数据源暂时不可用');
});

it('合并结果不污染数据源缓存', async () => {
 const cached = Object.freeze([{ title: 'Solar' }]);
 jest.mocked(searchPapers).mockResolvedValue({ total: 1, papers: cached } as any);
 jest.mocked(searchOpenAlex).mockResolvedValue([{ title: 'Battery' }] as any);
 jest.mocked(searchArxiv).mockResolvedValue([]);
 expect((await unifiedSearch('solar')).papers).toHaveLength(2);
 expect(cached).toHaveLength(1);
});

it('所有来源均不能绕过年份与开放全文筛选', async () => {
 jest.mocked(searchPapers).mockResolvedValue({ total: 1, papers: [{ title: 'Old', year: 2019, pdfUrl: 'https://example.org/a' }] } as any);
 jest.mocked(searchOpenAlex).mockResolvedValue([
  { title: 'Closed', year: 2025 }, { title: 'Unknown', year: null, pdfUrl: 'https://example.org/b' },
  { title: 'Valid', year: 2025, pdfUrl: 'https://example.org/c' }
 ] as any);
 jest.mocked(searchArxiv).mockResolvedValue([{ title: 'Future', year: 2027, pdfUrl: 'https://example.org/d' }] as any);
 const result = await unifiedSearch('solar', { yearFrom: 2024, yearTo: 2026, openAccess: true });
 expect(result.papers.map(p => p.title)).toEqual(['Valid']);
});

it('总数是去重结果窗口，offset 作用于合并结果而非单个来源', async () => {
 jest.mocked(searchPapers).mockResolvedValue({ total: 10000, papers: [{ title: 'A' }, { title: 'B' }] } as any);
 jest.mocked(searchOpenAlex).mockResolvedValue([{ title: 'A' }, { title: 'C' }] as any);
 jest.mocked(searchArxiv).mockResolvedValue([]);
 const result = await unifiedSearch('solar', { limit: 1, offset: 2 });
 expect(result).toMatchObject({ total: 3, totalScope: 'retrieved_window', papers: [{ title: 'C' }] });
 expect(searchPapers).toHaveBeenLastCalledWith('solar', expect.objectContaining({ limit: 100, offset: 0 }));
});
