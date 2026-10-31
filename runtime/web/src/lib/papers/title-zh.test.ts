import { arxivIdOf, lookupTitleZh, withChineseTitle, buildTitleIndex } from './title-zh';
import data from '@/data/paper-title-zh.json';

const base = { id: 'x', title: 'Graph Retrieval-Augmented Generation: A Survey', authors: [], year: 2024, abstract: '', citationCount: null };

describe('英文论文标题中文译名', () => {
  it('数据文件：每条都有中文译名、原文标题、原文链接，且状态为待审核', () => {
    expect(data.items.length).toBeGreaterThanOrEqual(50);
    const keys = new Set<string>();
    for (const item of data.items) {
      expect(item.titleZh).toMatch(/[\u4e00-\u9fff]/);
      expect(item.titleOriginal).not.toMatch(/[\u4e00-\u9fff]/);
      expect(item.titleOriginal).not.toMatch(/^arXiv:/i); // 没有真实原标题的不收录
      expect(item.sourceUrl).toMatch(/^https:\/\/(arxiv\.org\/abs|doi\.org)\//);
      expect(item.reviewStatus).toBe('待审核');
      expect(keys.has(item.key)).toBe(false);
      keys.add(item.key);
    }
  });

  it('按 arXiv 编号、DOI、原文标题匹配；原文标题 title 不被改写', () => {
    const byArxiv = withChineseTitle({ ...base, title: 'whatever', id: 'arXiv:2408.08921v2', sourceUrl: 'https://arxiv.org/abs/2408.08921v2' });
    expect(byArxiv.titleZh).toBe('图检索增强生成：综述');
    expect(byArxiv.title).toBe('whatever');
    const byDoi = withChineseTitle({ ...base, title: 'x', doi: 'https://doi.org/10.1038/s41586-023-06180-8' });
    expect(byDoi.titleZh).toContain('光伏与风电');
    const byTitle = withChineseTitle(base);
    expect(byTitle.titleZh).toBe('图检索增强生成：综述');
    expect(byTitle.titleZhStatus).toBe('待审核');
  });

  it('对不上就不显示译名；中文标题不重复加译名', () => {
    expect(withChineseTitle({ ...base, title: 'A paper we have never seen' }).titleZh).toBeUndefined();
    expect(withChineseTitle({ ...base, title: '光伏组件积灰' }).titleZh).toBeUndefined();
  });

  it('arXiv 编号只从 arxiv 来源提取，不会把 DOI 里的数字误当编号', () => {
    expect(arxivIdOf('10.1016/j.apenergy.2021.117766')).toBeNull();
    expect(arxivIdOf('https://doi.org/10.1016/j.apenergy.2021.117766')).toBeNull();
    expect(arxivIdOf('2408.08921v3')).toBe('2408.08921');
    expect(arxivIdOf('https://arxiv.org/pdf/2408.08921v1')).toBe('2408.08921');
  });

  it('译名缺中文时被忽略', () => {
    const index = buildTitleIndex([{ key: 'arxiv:1', titleOriginal: 'T', titleZh: 'English only', reviewStatus: '待审核' }]);
    expect(lookupTitleZh({ id: '1', title: 'T' }, index)).toBeNull();
  });
});
