import registry from '@/lib/entitlements/entitlements.json';
import { USAGE_LIMITS } from '@/lib/membership/plans';

/**
 * 注册表（/api/entitlements、定价页口径）里写的额度，必须和服务端真正执行的 USAGE_LIMITS 一致。
 * 原来两边各写各的：免费版 AI 注册表写 20 次、实际 3 次；专业版注册表 200 次、实际 100 次；
 * 专业版项目数注册表 10、实际 50；团队版项目数注册表「不限」、实际 500。
 * 对外口径和实际执行对不上，客服和销售都会承诺错。
 */
type Quotas = Record<string, number | undefined>;
const MAP: { reg: (t: { quotas: Quotas; knowledge: Quotas }) => number | undefined; limit: keyof typeof USAGE_LIMITS['FREE']; label: string }[] = [
  { reg: (t) => t.quotas.ai_queries_per_day, limit: 'ai_chat', label: '每日 AI 对话' },
  { reg: (t) => t.quotas.resource_queries_per_day, limit: 'resource_query', label: '每日资源查询' },
  { reg: (t) => t.quotas.calculations_per_day, limit: 'calculation', label: '每日测算' },
  { reg: (t) => t.knowledge.paper_search_per_day, limit: 'paper_search', label: '每日文献检索' },
  { reg: (t) => t.quotas.diagnoses_per_day, limit: 'diagnosis', label: '每日运维诊断' },
  { reg: (t) => t.quotas.max_projects, limit: 'projects', label: '项目数' },
  { reg: (t) => t.quotas.max_stations, limit: 'stations', label: '电站数' },
];

const toRegistry = (n: number) => (n === Infinity ? -1 : n);

describe('注册表额度与服务端执行的额度一致', () => {
  for (const [tierId, tier] of Object.entries(registry.tiers)) {
    it(`${tierId}`, () => {
      const plan = tierId.toUpperCase() as keyof typeof USAGE_LIMITS;
      const diffs: string[] = [];
      for (const m of MAP) {
        const advertised = m.reg(tier as never) ?? 0; // 没写 = 没有这项额度 = 0
        const enforced = toRegistry(USAGE_LIMITS[plan][m.limit]);
        if (advertised !== enforced) diffs.push(`${m.label}：注册表 ${advertised}，实际执行 ${enforced}`);
      }
      expect(diffs).toEqual([]);
    });
  }

  it('定价文案里写出的数字也与额度一致（免费版 AI 次数、专业版 AI 次数）', () => {
    const free = registry.tiers.free.features_zh.join('|');
    expect(free).toContain(`每日 ${USAGE_LIMITS.FREE.ai_chat} 次 AI 对话`);
    expect(registry.tiers.pro.features_zh.join('|')).toContain(`每日 ${USAGE_LIMITS.PRO.ai_chat} 次 AI 对话`);
    expect(registry.tiers.maintenance.features_zh.join('|')).toContain(`每日 ${USAGE_LIMITS.MAINTENANCE.ai_chat} 次 AI 对话`);
  });
});
