import registry from '@/lib/entitlements/entitlements.json';
import { EXPORT_FORMATS, PLAN_DETAILS, PLAN_ORDER, PURCHASABLE_PLANS, Plan } from '@/lib/membership/plans';

describe('会员五档（免费 / ¥1,980 / ¥5,800 / ¥16,800 / ¥33,000）', () => {
  it('在售档位与年付价格', () => {
    expect(PLAN_ORDER.map((p) => PLAN_DETAILS[p].yearlyPrice)).toEqual([0, 1980, 5800, 16800, 33000]);
    expect(registry.tier_order).toEqual(PLAN_ORDER.map((p) => p.toLowerCase()));
    expect(PURCHASABLE_PLANS).not.toContain(Plan.MAINTENANCE);
  });
  it('Excel / PPT 只在专业、团队和上限档', () => {
    expect(EXPORT_FORMATS.FREE).not.toEqual(expect.arrayContaining(['Excel', 'PPT']));
    expect(EXPORT_FORMATS.PRO).not.toEqual(expect.arrayContaining(['Excel', 'PPT']));
    expect(EXPORT_FORMATS.FULL).toEqual(expect.arrayContaining(['Excel', 'PPT']));
    expect(EXPORT_FORMATS.TEAM).toEqual(expect.arrayContaining(['Excel', 'PPT']));
    expect(EXPORT_FORMATS.ENTERPRISE).toEqual(expect.arrayContaining(['Excel', 'PPT']));
    expect(EXPORT_FORMATS.ENTERPRISE).not.toContain('White_Label');
    expect(PLAN_DETAILS.FULL.description).toContain('3 个席位');
  });
});
