/**
 * 视觉回归草稿。基线截图需要企业微信确认后的构建环境，这里不自动更新基线。
 */
import { test } from '@playwright/test';

test('五个种子用户首页', async ({ page }) => {
    test.skip(!process.env.NENGJIAN_E2E_BASE, '未配置本地服务地址');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/preview/p1');
    await page.screenshot({ path: 'preview-1440.png', fullPage: true });
});
