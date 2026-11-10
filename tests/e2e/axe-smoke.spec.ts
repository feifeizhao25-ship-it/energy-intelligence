import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke only. Fails on serious or critical axe violations.
 * This is not a WCAG certification and does not call a model, a payment provider, or Amap.
 */

const BLOCKED = /amap\.com|autonavi\.com|stripe\.com|openai\.com|deepseek|minimaxi|minimax|anthropic|generativelanguage/i;

type RouteCase = {
  project: 'cn' | 'global' | 'intl';
  path: string;
  ready: string | RegExp;
};

const ROUTES: RouteCase[] = [
  { project: 'cn', path: '/', ready: '按角色查看已收录的事实' },
  { project: 'cn', path: '/login', ready: '手机号' },
  { project: 'cn', path: '/map', ready: '地图服务暂不可用' },
  { project: 'cn', path: '/map/report', ready: '无效的坐标参数' },
  { project: 'cn', path: '/pricing', ready: /免费|年/ },
  { project: 'global', path: '/', ready: /EnergyIQ|Dashboard|Projects/ },
  { project: 'global', path: '/incentives', ready: 'Eligible capital expenditure' },
  { project: 'intl', path: '/', ready: 'Move from resource data' },
  { project: 'intl', path: '/pricing', ready: 'price unavailable' },
];

async function blockLiveServices(page: Page) {
  await page.route(BLOCKED, (route) => route.abort());
}

async function seriousOrCritical(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical');
}

for (const route of ROUTES) {
  test(`@${route.project} ${route.path} has no serious or critical axe violations`, async ({ page }) => {
    await blockLiveServices(page);
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response, route.path).not.toBeNull();
    expect(response!.status(), route.path).toBeLessThan(400);
    await expect(page.getByText(route.ready).first()).toBeVisible();
    if (route.path === '/map') {
      await expect(page.getByText('请直接填写经纬度').first()).toBeVisible();
    }
    const violations = await seriousOrCritical(page);
    expect(violations, JSON.stringify(violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      help: item.help,
      nodes: item.nodes.slice(0, 3).map((node) => node.target),
    })), null, 2)).toEqual([]);
  });
}
