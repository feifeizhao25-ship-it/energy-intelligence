import { verificationView } from './verification';

describe('审计 7-5 引用卡核验状态', () => {
  it('三种标签：已核验 / 待核验 / 冲突', () => {
    expect(verificationView({ status: 'verified' }).label).toBe('已核验');
    expect(verificationView({ status: 'review_recommended' }).label).toBe('待核验');
    expect(verificationView({ status: 'conflict' }).label).toBe('冲突');
  });
  it('缺失或未知状态按待核验处理，且不可作为结论依据', () => {
    const v = verificationView(undefined);
    expect(v.label).toBe('待核验');
    expect(v.usableAsConclusion).toBe(false);
    expect(verificationView({ status: 'bogus' as any }).status).toBe('unverified');
  });
});

import { verifySources, collectSourcesFromToolResult } from './verification';

describe('web /api/chat 核验规则（与后端一致）', () => {
  const gov = { publisher: '国家能源局', url: 'https://www.nea.gov.cn/a' };
  const media = { publisher: '中国能源报', url: 'https://www.cnenergynews.cn/b' };
  it('官方原文 + 独立来源 → 已核验', () => {
    expect(verifySources([gov, media]).status).toBe('verified');
  });
  it('只有第三方 → 待核验；无来源 → 待核验并说明基于模型知识', () => {
    expect(verifySources([media]).status).toBe('review_recommended');
    const none = verifySources([]);
    expect(none.label).toBe('待核验');
    expect(none.reason).toContain('模型知识');
  });
  it('从工具结果递归收集来源，已知工具无来源字段时用固定来源', () => {
    const r = collectSourcesFromToolResult('search_policy', { items: [{ title: '通知', source_url: 'https://www.ndrc.gov.cn/x', source_org: '国家发展改革委' }] });
    expect(r[0].publisher).toBe('国家发展改革委');
    expect(collectSourcesFromToolResult('get_solar_resource', { annual: 1 })[0].publisher).toBe('NASA POWER');
  });
});
