import registry from '@/lib/entitlements/entitlements.json';
import { PLANS } from './config';

describe('会员名称和额度只来自权益注册表', () => {
  it('六档名称与注册表中文名一致', () => {
    expect(PLANS.FREE.name).toBe(registry.tiers.free.name);
    expect(PLANS.PRO.name).toBe(registry.tiers.pro.name);
    expect(PLANS.FULL.name).toBe(registry.tiers.full.name);
    expect(PLANS.TEAM.name).toBe(registry.tiers.team.name);
    expect(PLANS.ENTERPRISE.name).toBe(registry.tiers.enterprise.name);
    expect(PLANS.MAINTENANCE.name).toBe(registry.tiers.maintenance.name);
    expect(PLANS.PRO.name).not.toBe('专业版');
  });

  it('专业档每日 AI 次数与注册表相同', () => {
    expect(PLANS.PRO.aiCalls).toBe(registry.tiers.pro.quotas.ai_queries_per_day);
    expect(PLANS.FREE.aiCalls).toBe(registry.tiers.free.quotas.ai_queries_per_day);
  });
});
