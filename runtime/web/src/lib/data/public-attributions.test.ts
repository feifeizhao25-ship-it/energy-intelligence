import catalog from '@/data/public-source-attributions.json';
import { disabledReasons, enabledAttributions } from './public-attributions';

it('启用来源带署名，付费墙和科研限定来源保持关闭', () => {
  const enabled = enabledAttributions(catalog);
  expect(enabled.length).toBeGreaterThan(10);
  expect(enabled.every((item) => item.attribution.includes('数据来自'))).toBe(true);
  const disabled = disabledReasons(catalog);
  expect(disabled.find((item) => item.name.includes('知网'))?.reason).toMatch(/付费/);
  expect(disabled.find((item) => item.name.includes('万方'))?.reason).toMatch(/付费/);
  expect(disabled.find((item) => item.name.includes('PVOD'))?.reason).toMatch(/科学/);
  expect(disabled.find((item) => item.name.includes('气象'))?.reason).toMatch(/授权/);
  expect(enabled.find((item) => item.name.includes('知网'))).toBeUndefined();
});
