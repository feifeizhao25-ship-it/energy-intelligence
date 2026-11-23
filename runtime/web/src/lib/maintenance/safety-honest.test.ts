/** 核9：安全规程工具不假装检索；标准号更新；储能热管理不给无出处的处置指令和风险百分比。 */
import { searchSafetyRegulations } from './safety';
import { analyzeThermal } from './storage';

describe('安全规程工具（核9）', () => {
  it('明确未检索，没有假相关度和 # 链接，35694 用 2025 版', async () => {
    const t0 = Date.now();
    const r = await searchSafetyRegulations({ query: '光伏 检修' } as any);
    expect(Date.now() - t0).toBeLessThan(200); // 不再有 1.2 秒假延迟
    expect(r.searched).toBe(false);
    expect(r.note).toMatch(/暂无安全规程检索/);
    const codes = r.regulations.map((x) => x.code);
    expect(codes).toContain('GB/T 35694-2025');
    expect(codes).not.toContain('GB/T 35694-2017');
    for (const x of r.regulations) {
      expect(x.relevance).toBeNull();
      expect(x.link).toMatch(/^https:\/\/std\.samr\.gov\.cn\//);
      expect(x.versionNote).toBeTruthy();
    }
  });
  it('按类别过滤：风电不出光伏规程', async () => {
    const r = await searchSafetyRegulations({ query: '', category: 'wind' } as any);
    expect(r.regulations.map((x) => x.code)).toEqual(['GB 26860-2011', 'DL/T 796-2012']);
  });
});

describe('储能热管理（核9）', () => {
  it('超过示例阈值时让用户按规程和厂家手册处置，不下停机指令、不给风险百分比', async () => {
    const r = await analyzeThermal({ temperatures: [35, 52, 65] } as any);
    expect(r.status).toBe('critical');
    expect(r.runawayRisk).toBeNull();
    expect(r.coolingAction).not.toMatch(/强冷|停止充放电/);
    expect(r.coolingAction).toMatch(/厂家手册/);
    expect(r.thresholdNote).toMatch(/没有标准出处/);
    expect((await analyzeThermal({ temperatures: [30, 31] } as any)).status).toBe('normal');
  });
});
