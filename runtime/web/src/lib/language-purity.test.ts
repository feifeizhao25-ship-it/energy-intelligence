import { execFileSync } from 'child_process';
import path from 'path';

describe('国内版语言纯净度', () => {
  it('中文页面可见文案不含非白名单英文', () => {
    const root = path.resolve(__dirname, '../..');
    const out = execFileSync('node', ['scripts/check-language-purity.mjs'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('检查通过');
  });
});
