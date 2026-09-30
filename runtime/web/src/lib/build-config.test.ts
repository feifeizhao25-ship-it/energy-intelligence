import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// scripts/test-public-build-config.mjs 是独立的 node 脚本，没人手动跑就等于没有。
// 这里把它接进 jest：构建期检查（国内版专用、拒绝任何 Supabase 配置）的回归会让 npm test 变红。
describe('构建期公开配置检查', () => {
  it('scripts/test-public-build-config.mjs 全部用例通过', () => {
    const out = execFileSync('node', [join(__dirname, '..', '..', 'scripts', 'test-public-build-config.mjs')], { encoding: 'utf8' });
    expect(out).toMatch(/public build configuration cases passed/);
  });
});
