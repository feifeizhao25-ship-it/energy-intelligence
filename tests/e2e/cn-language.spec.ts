/**
 * 63 个路由 × 5 个角色的可见文本巡检。
 * 没有本地服务时跳过，不把跳过写成通过。
 */
import { test, expect } from '@playwright/test';
import { CN_ROUTES, SCAN_ROLES } from './cn-routes';

const englishRun = /[A-Za-z]+(?:\s+[A-Za-z]+){4,}/;

test.describe('国内版可见文本', () => {
    test.skip(!process.env.NENGJIAN_E2E_BASE, '未配置本地服务地址');
    test('路由数量', () => {
        expect(CN_ROUTES).toHaveLength(63);
        expect(SCAN_ROLES).toHaveLength(5);
    });
    for (const role of SCAN_ROLES) {
        for (const path of CN_ROUTES) {
            test(`${role} ${path}`, async ({ page }) => {
                const base = process.env.NENGJIAN_E2E_BASE || '';
                await page.goto(`${base}${path}?role=${role}`);
                const text = await page.locator('body').innerText();
                expect(text).not.toMatch(englishRun);
            });
        }
    }
});
