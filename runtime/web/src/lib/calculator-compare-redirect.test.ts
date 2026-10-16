import { readFileSync } from 'fs';
import { join } from 'path';

describe('/calculator/compare 旧页面', () => {
  const src = readFileSync(join(__dirname, '..', 'proxy.ts'), 'utf8');
  it('重定向到现行的 /quick-calc/compare，而不是渲染 404 或写死电价的旧页', () => {
    expect(src).toMatch(/path === '\/calculator\/compare'[\s\S]{0,120}redirect\(siteUrl\(req, '\/quick-calc\/compare'\)\)/);
    expect(src).not.toMatch(/localizedOnly = \[[^\]]*calculator\/compare/);
  });
});
