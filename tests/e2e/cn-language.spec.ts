/**
 * 页面巡检草稿。没有本地服务时跳过，不把失败伪装成通过。
 * 正式巡检应登录 5 个种子用户，遍历国内版页面并检查可见英文句。
 */
import { test } from '@playwright/test';

const pages = [
    '/preview/p1',
    '/freshness',
    '/team',
    '/dashboard',
    '/onboarding',
    '/settings',
    '/calculator/solar',
    '/policies',
];

test.describe('国内版可见文本', () => {
    test.skip(!process.env.NENGJIAN_E2E_BASE, '未配置本地服务地址，巡检留给带浏览器的环境');
    for (const path of pages) {
        test(path, async ({ page }) => {
            await page.goto(path);
            const text = await page.locator('body').innerText();
            test.expect(text).not.toMatch(/[A-Za-z]+(?:\s+[A-Za-z]+){4,}/);
        });
    }
});
