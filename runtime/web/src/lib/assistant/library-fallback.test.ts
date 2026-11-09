import { citationText } from './citation-text';
import { clearLibraryCache, libraryStandIn, searchLibrary } from './library-fallback';

beforeEach(() => clearLibraryCache());

test('国内资料库命中保留原文定位，并标明没有人工复核', () => {
  const reply = libraryStandIn('新能源上网电价市场化改革 机制电价');
  expect(reply.text).toContain('未调用模型');
  expect(reply.sources[0]?.url).toContain('ndrc.gov.cn');
  expect(reply.sources[0]?.locator).toContain('机制电价');
  expect(reply.sources[0]?.published_at).toBe('2025-02-09');
  expect(reply.sources[0]?.date_kind).toBe('page_release');
  expect(reply.sources[0]?.sign_date).toBe('2025-01-27');
  expect(reply.sources[0]?.excerpt).toContain('不高于当地煤电基准价');
  expect(reply.sources[0]?.note).toContain('没有人工复核记录');
  const copied = citationText(reply.text, reply.sources);
  expect(copied).toContain('页面发布时间：2025-02-09');
  expect(copied).toContain('落款日期：2025-01-27');
  expect(copied).toContain('原文未写单一施行日');
  expect(copied).not.toContain('日期：2025-02-09');
  expect(copied).toContain(reply.sources[0]?.url || '');
  expect(copied).toContain('定位：');
  expect(copied).not.toContain('已审核');
});

test('待核实条目不能被国内助手当作已发布来源', () => {
  const sources = searchLibrary('新型储能并网调度规则', 'cn');
  expect(sources.map((source) => source.title)).not.toContain('新型储能并网调度规则');
});

test('没有命中时拒绝作答，不生成替代结论', () => {
  const reply = libraryStandIn('虚构县 ZZQQ-999 的区划罚则');
  expect(reply.sources).toEqual([]);
  expect(reply.text).toContain('没有可引用的来源');
  expect(reply.text).toContain('未调用模型');
});
