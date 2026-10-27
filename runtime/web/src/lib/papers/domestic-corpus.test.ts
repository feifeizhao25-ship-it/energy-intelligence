import { citationEdges, domesticSearchResult, overseasLiveEnabled, searchCorpus } from './domestic-corpus';

const sample = [{
  source: 'arxiv-cache',
  externalId: '2401.00001',
  title: 'Photovoltaic soiling review',
  authors: 'Li, Wei',
  year: 2024,
  doi: '10.0000/soiling',
  abstract: '组件积灰综述',
  pdfUrl: 'https://arxiv.org/pdf/2401.00001',
  licence: 'arXiv metadata',
  licenceNote: '元数据来自批量导入，不是实时请求。',
  citations: [{ doi: '10.0000/cited', title: 'Cited paper' }],
}, {
  source: 'openalex-cache',
  externalId: 'W1',
  title: 'Cited paper',
  year: 2020,
  doi: '10.0000/cited',
  licence: 'CC0',
  licenceNote: 'OpenAlex 元数据为 CC0。',
  citations: [],
}];

it('空语料给出未配置说明，不返回论文', () => {
  const result = domesticSearchResult([], '光伏');
  expect(result.papers).toEqual([]);
  expect(result.notice).toBe('未配置国内学术源/未开启境外');
});

it('只检索已入库记录，并带出许可说明', () => {
  const papers = searchCorpus(sample, '积灰', { openAccess: true });
  expect(papers.map((paper) => paper.title)).toEqual(['Photovoltaic soiling review']);
  expect((papers[0] as { licenceNote?: string }).licenceNote).toMatch(/批量导入/);
  expect(searchCorpus(sample, '积灰', { yearFrom: 2025 })).toEqual([]);
});

it('引用边只连接语料里能对上的 DOI，不补模拟节点', () => {
  const graph = citationEdges(sample);
  expect(graph.nodes).toHaveLength(2);
  expect(graph.edges).toEqual([{ from: '2401.00001', to: 'W1', doi: '10.0000/cited' }]);
  expect(citationEdges([{ ...sample[0], citations: [{ doi: '10.9/missing' }] }]).edges).toEqual([]);
});

it('境外开关默认关闭', () => {
  const previous = process.env.OVERSEAS_LIVE;
  const ack = process.env.OVERSEAS_PRIVACY_ACK;
  delete process.env.OVERSEAS_LIVE;
  delete process.env.OVERSEAS_PRIVACY_ACK;
  expect(overseasLiveEnabled()).toBe(false);
  process.env.OVERSEAS_LIVE = '1';
  expect(overseasLiveEnabled()).toBe(false);
  process.env.OVERSEAS_PRIVACY_ACK = '1';
  expect(overseasLiveEnabled()).toBe(true);
  if (previous === undefined) delete process.env.OVERSEAS_LIVE; else process.env.OVERSEAS_LIVE = previous;
  if (ack === undefined) delete process.env.OVERSEAS_PRIVACY_ACK; else process.env.OVERSEAS_PRIVACY_ACK = ack;
});
