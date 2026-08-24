import { load } from 'cheerio';

const baseUrl = (process.env.I18N_CHECK_BASE_URL || 'http://127.0.0.1:4311').replace(/\/$/, '');
const routes = [
  '/',
  '/login',
  '/pricing',
  '/checkout?plan=PRO&billing=monthly',
  '/demo-request?market=global&plan=ENTERPRISE',
  '/privacy',
  '/terms',
  '/developer/docs',
];
const failures = [];

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { cookie: 'NEXT_LOCALE=en', 'accept-language': 'en-US,en;q=0.9' },
    redirect: 'manual',
  });
  if (response.status >= 300 && response.status < 400) {
    failures.push(`${route}: unexpected redirect to ${response.headers.get('location') || 'unknown location'}`);
    continue;
  }
  if (!response.ok) {
    failures.push(`${route}: HTTP ${response.status}`);
    continue;
  }
  const html = await response.text();
  const $ = load(html);
  $('script,style,noscript,template').remove();
  const visibleText = $('body').text().replace(/\s+/g, ' ').trim();
  const matches = visibleText.match(/[\u3400-\u9fff][\u3400-\u9fff\s，。；：！？、《》“”‘’（）·-]{0,40}/g) || [];
  if (matches.length) failures.push(`${route}: ${matches.slice(0, 5).join(' | ')}`);
}

const specResponse = await fetch(`${baseUrl}/api/v1/docs?locale=en`, { headers: { 'accept-language': 'en-US,en;q=0.9' } });
if (!specResponse.ok) {
  failures.push(`/api/v1/docs?locale=en: HTTP ${specResponse.status}`);
} else {
  const specText = await specResponse.text();
  if (/[㐀-鿿]/.test(specText)) failures.push('/api/v1/docs?locale=en: Chinese characters found in JSON');
  const spec = JSON.parse(specText);
  const requiredPaths = ['/projects', '/projects/{id}', '/projects/{id}/monitoring', '/projects/{id}/analytics', '/papers/search', '/calculate/solar'];
  for (const path of requiredPaths) if (!spec.paths?.[path]) failures.push(`/api/v1/docs: missing ${path}`);
  if (spec.paths?.['/projects/{id}/analytics']?.get?.responses?.['200']) failures.push('/api/v1/docs: analytics incorrectly advertises a 200 response');
  if (!spec.paths?.['/projects/{id}/analytics']?.get?.responses?.['503']) failures.push('/api/v1/docs: analytics must document its fail-closed 503 response');
}

if (failures.length) {
  console.error('International-route Chinese leakage detected:\n' + failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`International locale boundary passed for ${routes.length} public routes and the OpenAPI document.`);
