import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEGAL_VERSION } from './consent';

/** 条款/隐私政策页上的「生效日期」必须与登录时记录的版本一致：改了正文忘了改版本，同意凭证就对不上。 */
describe('同意凭证版本', () => {
  const [y, m, d] = LEGAL_VERSION.split('-').map(Number);
  const zh = `生效日期：${y}年${m}月${d}日`;
  for (const page of ['terms', 'privacy']) {
    it(`${page} 页的中文生效日期与 LEGAL_VERSION 一致`, () => {
      const src = readFileSync(join(__dirname, '..', '..', 'app', page, 'page.tsx'), 'utf8');
      expect(src).toContain(zh);
    });
  }
});
