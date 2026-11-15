import { defineConfig, devices } from '@playwright/test';

/** 只打已启动的国内站，不拉起国际版。 */
export default defineConfig({
    testDir: '.',
    testMatch: 'display-console.spec.ts',
    timeout: 45_000,
    reporter: 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.NENGJIAN_E2E_BASE || 'http://127.0.0.1:3101',
    },
});
