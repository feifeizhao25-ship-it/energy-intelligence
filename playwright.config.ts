import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // axe-smoke.spec.ts 只能在 playwright.axe.config.ts 下跑（那里按 cn/global/intl 给了 baseURL 和各自的开发服务器）。
  // 在这份通用配置里它没有 baseURL，page.goto('/') 直接报 "Cannot navigate to invalid URL"，根本没跑到 axe 检查。
  testIgnore: ['**/axe-smoke.spec.ts'],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -- --port 3101',
      cwd: 'runtime/web',
      url: 'http://127.0.0.1:3101',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm exec next dev -p 3102',
      cwd: 'web-global',
      url: 'http://127.0.0.1:3102',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
