// 国内版语言边界运行时检查：即使浏览器带英文 Cookie / Accept-Language，公开页面和开放 API 文档也只输出中文。
// 国际版英文首页、en.json、LanguageSwitcher 已从国内树删除；这里防止英文分支被重新引入。
import { load } from 'cheerio';

const baseUrl = (process.env.I18N_CHECK_BASE_URL || 'http://127.0.0.1:4311').replace(/\/$/, '');
const routes = [
  '/',
  '/login',
  '/pricing',
  '/checkout?plan=PRO&billing=monthly',
  '/demo-request?plan=ENTERPRISE',
  '/privacy',
  '/terms',
  '/developer/docs',
];
// 已删除的国际版文案里的标志性短语
const ENGLISH_MARKERS = ['Energy Intelligence', 'Terms of Service', 'Privacy Policy', 'Request a quote', 'Back to plans', 'Order review', 'Switch to English'];
const failures = [];

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { cookie: 'NEXT_LOCALE=en', 'accept-language': 'en-US,en;q=0.9' },
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) continue; // 需要登录的页面会跳转到中文登录页
  if (!response.ok) {
    failures.push(`${route}: HTTP ${response.status}`);
    continue;
  }
  const html = await response.text();
  const $ = load(html);
  $('script,style,noscript,template').remove();
  const visibleText = $('body').text().replace(/\s+/g, ' ').trim();
  if (!/[㐀-鿿]/.test(visibleText)) failures.push(`${route}: 页面没有中文`);
  for (const marker of ENGLISH_MARKERS) if (visibleText.includes(marker)) failures.push(`${route}: 出现英文文案「${marker}」`);
}

const enRedirect = await fetch(`${baseUrl}/en`, { redirect: 'manual' });
if (!(enRedirect.status >= 300 && enRedirect.status < 400)) failures.push(`/en: 应重定向到中文首页，实际 HTTP ${enRedirect.status}`);

const specResponse = await fetch(`${baseUrl}/api/v1/docs?locale=en`, { headers: { 'accept-language': 'en-US,en;q=0.9' } });
if (!specResponse.ok) {
  failures.push(`/api/v1/docs?locale=en: HTTP ${specResponse.status}`);
} else {
  const spec = await specResponse.json();
  if (!/[㐀-鿿]/.test(spec.info?.title || '')) failures.push('/api/v1/docs: 标题不是中文');
  const requiredPaths = ['/projects', '/projects/{id}', '/projects/{id}/monitoring', '/projects/{id}/analytics', '/papers/search', '/calculate/solar'];
  for (const path of requiredPaths) if (!spec.paths?.[path]) failures.push(`/api/v1/docs: missing ${path}`);
  if (spec.paths?.['/projects/{id}/analytics']?.get?.responses?.['200']) failures.push('/api/v1/docs: analytics incorrectly advertises a 200 response');
  if (!spec.paths?.['/projects/{id}/analytics']?.get?.responses?.['503']) failures.push('/api/v1/docs: analytics must document its fail-closed 503 response');
}

if (failures.length) {
  console.error('国内版语言边界检查失败:\n' + failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`国内版语言边界检查通过：${routes.length} 个公开页面与开放 API 文档在英文浏览器下仍只输出中文。`);
