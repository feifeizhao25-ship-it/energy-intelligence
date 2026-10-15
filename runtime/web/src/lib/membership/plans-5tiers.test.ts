import registry from '@/lib/entitlements/entitlements.json';
import { EXPORT_FORMATS, PLAN_DETAILS, PLAN_ORDER, PURCHASABLE_PLANS, Plan } from '@/lib/membership/plans';

describe('会员五档（免费 / ¥1,980 / ¥5,800 / ¥16,800 / ¥33,000）', () => {
  it('在售档位与年付价格', () => {
    expect(PLAN_ORDER.map((p) => PLAN_DETAILS[p].yearlyPrice)).toEqual([0, 1980, 5800, 16800, 33000]);
    expect(registry.tier_order).toEqual(PLAN_ORDER.map((p) => p.toLowerCase()));
    expect(PURCHASABLE_PLANS).not.toContain(Plan.MAINTENANCE);
  });
  it('上线时任何档位都不含 Excel / PPT', () => {
    for (const fmts of Object.values(EXPORT_FORMATS)) {
      expect((fmts as readonly string[]).filter((f) => /excel|xlsx|ppt/i.test(f))).toEqual([]);
    }
  });
});
