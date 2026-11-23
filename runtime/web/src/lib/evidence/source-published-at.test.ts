import { collectSourcesFromToolResult } from './verification';

describe('工具结果来源带上发布日期（回答底部日期行用）', () => {
  it('published_at / publish_date 透传，没有就不加', () => {
    const out = collectSourcesFromToolResult('search_policy_library', {
      sources: [
        { title: '114号文', url: 'https://www.ndrc.gov.cn/a', source_org: '国家发展改革委', published_at: '2025-09-28' },
        { title: '688号文', url: 'https://www.nea.gov.cn/b', source_org: '国家能源局', publish_date: ' 2025-05-30 ' },
        { title: '无日期', url: 'https://example.gov.cn/c', source_org: '某局' },
      ],
    });
    expect(out.map((s) => s.published_at)).toEqual(['2025-09-28', '2025-05-30', undefined]);
  });
});
