/** 首页、登录、结算页必须服务端输出中文内容（check-i18n-runtime 依赖），不能退化为只有加载圈/空 Suspense 兜底。 */
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf8');

describe('公开页 SSR 内容', () => {
  it('首页不再用 isClient 门控整页', () => {
    expect(read('page.tsx')).not.toMatch(/if \(!isClient\)/);
  });
  it('登录页由服务端读取 callbackUrl，表单不再依赖 useSearchParams', () => {
    expect(read('login/page.tsx')).toContain('await searchParams');
    expect(read('login/login-form.tsx')).not.toContain('useSearchParams');
  });
  it('结算页由服务端读取 plan/billing', () => {
    expect(read('(dashboard)/checkout/page.tsx')).toContain('await searchParams');
    expect(read('(dashboard)/checkout/checkout-client.tsx')).not.toContain('useSearchParams');
  });
});
