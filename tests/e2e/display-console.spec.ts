/**
 * 每条国内路由的控制台错误和空白页检查。
 * 需要已启动的国内站：NENGJIAN_E2E_BASE=http://127.0.0.1:3101
 * 不启动 web-global。角色会话由语言扫描或登录态提供，这里不伪造审核结论。
 */
import { expect, test } from '@playwright/test';
import { CN_ROUTES } from './cn-routes';

const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '390', width: 390, height: 844 },
];

test.describe('国内版显示', () => {
    test.skip(!process.env.NENGJIAN_E2E_BASE, '未配置本地服务地址');

    for (const viewport of viewports) {
        test(`${viewport.name} 全部路由没有崩溃或空白`, async ({ page }) => {
            test.setTimeout(CN_ROUTES.length * 20_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            const problems: string[] = [];
            for (const path of CN_ROUTES) {
                const consoleErrors: string[] = [];
                const onConsole = (msg: { type: () => string; text: () => string }) => {
                    if (msg.type() === 'error') consoleErrors.push(msg.text());
                };
                page.on('console', onConsole);
                let status = 0;
                let text = '';
                try {
                    const response = await page.goto(`${process.env.NENGJIAN_E2E_BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    status = response?.status() || 0;
                    text = await page.locator('body').innerText({ timeout: 5000 });
                } catch (error) {
                    problems.push(`${path} 打不开 ${String(error).slice(0, 120)}`);
                }
                page.off('console', onConsole);
                if (status >= 500) problems.push(`${path} HTTP ${status}`);
                if (text.trim().length < 20) problems.push(`${path} 正文过短`);
                if (/Application error|Internal Server Error/i.test(text)) problems.push(`${path} 服务器错误页`);
                const noisy = consoleErrors.filter((item) => !item.includes('CLIENT_FETCH_ERROR') && !item.includes('Failed to fetch'));
                if (noisy.length) problems.push(`${path} 控制台 ${noisy[0].slice(0, 160)}`);
            }
            expect(problems, problems.join('\n')).toEqual([]);
        });
    }
});
