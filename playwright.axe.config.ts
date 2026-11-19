import { defineConfig, devices } from '@playwright/test';

const quiet = {
  NENGJIAN_DEEPSEEK_API_KEY: '',
  MINIMAX_CN_API_KEY: '',
  MINIMAX_INTL_API_KEY: '',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  AMAP_WEB_SERVICE_KEY: '',
  GAODE_MAP_KEY: '',
  TIANDITU_KEY: '',
  MAP_TILE_PROVIDER: '',
  NEXT_PUBLIC_AMAP_KEY: '',
  NEXT_PUBLIC_AMAP_SECURITY_CODE: '',
  STRIPE_SECRET_KEY: '',
};

// AXE_PROJECTS 选要跑的站点（逗号分隔，默认三个都跑）。国内专用的 axe 任务只设 AXE_PROJECTS=cn，
// 这样只起 runtime/web 一个开发服务器，不起国际版的两个。
const ALL_SITES = ['cn', 'global', 'intl'] as const;
type Site = (typeof ALL_SITES)[number];
const wanted = new Set(
  (process.env.AXE_PROJECTS || ALL_SITES.join(','))
    .split(',')
    .map((name) => name.trim())
    .filter((name): name is Site => (ALL_SITES as readonly string[]).includes(name)),
);

const servers = {
  cn: {
    command: 'npm run dev -- --port 3101',
    cwd: 'runtime/web',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: false,
    timeout: 180_000,
    // The language-scan flag already lets a local checker open known pages without a login.
    // It is set only for this smoke server. Production auth is unchanged.
    env: { ...process.env, ...quiet, NENGJIAN_LANGUAGE_SCAN: '1' },
  },
  global: {
    command: 'pnpm exec next dev -p 3102',
    cwd: 'web-global',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, ...quiet },
  },
  intl: {
    command: 'npm run dev -- --port 3103',
    cwd: 'runtime/web-int',
    url: 'http://127.0.0.1:3103',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, ...quiet },
  },
};

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'axe-smoke.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'cn', grep: /@cn\b/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3101' } },
    { name: 'global', grep: /@global\b/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3102' } },
    { name: 'intl', grep: /@intl\b/, use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3103' } },
  ].filter((project) => wanted.has(project.name as Site)),
  webServer: ALL_SITES.filter((site) => wanted.has(site)).map((site) => servers[site]),
});
