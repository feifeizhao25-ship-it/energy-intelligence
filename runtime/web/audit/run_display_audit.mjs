/**
 * 遍历国内版页面，记录空白、控制台错误、失败请求和英文残留。
 * 用法：先在 runtime/web 启动 next，再执行
 *   AUDIT_BASE=http://127.0.0.1:3101 node audit/run_display_audit.mjs
 * 需要本机已安装 playwright，并且浏览器可用。
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = new URL('..', import.meta.url).pathname
const appDir = join(root, 'src/app');
const outDir = join(root, 'audit');
const shotDir = join(outDir, 'shots');

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        return name === 'page.tsx' ? [full] : [];
    });
}

export function routesFromPages() {
    const routes = [];
    for (const file of walk(appDir)) {
        let route = '/' + relative(appDir, file).replace(/\/page\.tsx$/, '').replace(/\\/g, '/');
        if (route === '/page.tsx') route = '/';
        if (route.includes('[locale]')) continue;
        route = route
            .replace('/[id]', '/demo')
            .replace('/[snapshotId]', '/demo')
            .replace('/[type]', '/solar')
            .replace(/\/\([^)]+\)/g, '');
        route = route
            .replace('/projects/demo', '/projects/seed-investor-project')
            .replace('/project/demo', '/project/seed-investor-project');
        if (!routes.includes(route)) routes.push(route);
    }
    routes.sort();
    return routes;
}

const ENGLISH = /[A-Za-z]{4,}/g;
const ALLOW = new Set(['kwh', 'mwh', 'gwh', 'kwp', 'irr', 'npv', 'lcoe', 'lcos', 'pdf', 'word', 'excel', 'json', 'api', 'doi', 'nasa', 'iec', 'http', 'https', 'html', 'true', 'false', 'null', 'demo']);

function englishHits(text) {
    const runs = text.match(/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){2,}/g) || [];
    const hits = [];
    for (const run of runs) {
        const words = run.split(/\s+/).filter((word) => !ALLOW.has(word.toLowerCase()) && !/^[A-Z0-9_]{3,}$/.test(word));
        if (words.length >= 3) hits.push(run.slice(0, 80));
        if (hits.length > 6) break;
    }
    return hits;
}

const ROLES = [
    ['investor', '示例·投资者'],
    ['owner', '示例·业主'],
    ['engineer', '示例·工程师'],
    ['researcher', '示例·研究员'],
    ['government', '示例·园区'],
];

async function roleCookies() {
    if (process.env.AUDIT_SKIP_ROLES === '1') return [{ role: 'anonymous', cookie: '' }];
    const { encode } = await import('next-auth/jwt');
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return [{ role: 'anonymous', cookie: '' }];
    const cookies = [];
    for (const [role, name] of ROLES) {
        const token = await encode({
            secret,
            token: { id: `seed-${role}`, name, email: `seed-${role}@seed.invalid`, plan: 'PRO', profileCompleted: true, refreshedAt: Date.now() },
        });
        cookies.push({ role, cookie: token });
    }
    return cookies;
}

async function main() {
    const { chromium } = await import('playwright');
    const base = process.env.AUDIT_BASE || 'http://127.0.0.1:3101';
    const routes = routesFromPages();
    let sessions = await roleCookies();
    if (process.env.AUDIT_ROLES) {
        const wanted = new Set(process.env.AUDIT_ROLES.split(','));
        sessions = sessions.filter((item) => wanted.has(item.role));
    }
    const viewports = [
        { name: '1440', width: 1440, height: 900 },
        { name: '1280', width: 1280, height: 800 },
        { name: '390', width: 390, height: 844 },
        { name: '360', width: 360, height: 740 },
    ].filter((item) => !process.env.AUDIT_VIEWPORTS || process.env.AUDIT_VIEWPORTS.split(',').includes(item.name));
    mkdirSync(shotDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const rows = [];
    for (const session of sessions) {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport, locale: 'zh-CN' });
        if (session.cookie) {
            await context.addCookies([{
                name: 'next-auth.session-token',
                value: session.cookie,
                url: base,
                httpOnly: true,
                sameSite: 'Lax',
            }]);
        }
        const page = await context.newPage();
        for (const route of routes.map((item) => item.replaceAll('/seed-investor-project', `/seed-${session.role}-project`))) {
            const consoleErrors = [];
            const failed = [];
            const onConsole = (msg) => {
                if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 240));
            };
            const onFailed = (response) => {
                if (response.status() >= 400) failed.push(`${response.status()} ${response.url().slice(0, 180)}`);
            };
            page.on('console', onConsole);
            page.on('response', onFailed);
            let status = 0;
            let text = '';
            let error = '';
            try {
                const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
                status = response?.status() || 0;
                await page.waitForTimeout(400);
                text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
            } catch (exc) {
                error = String(exc).slice(0, 240);
            }
            const issues = [];
            if (error) issues.push({ type: 'crash', detail: error });
            if (status >= 400) issues.push({ type: 'http', detail: String(status) });
            if (text.trim().length < 20) issues.push({ type: 'blank', detail: text.trim().slice(0, 80) });
            const consoleLeft = consoleErrors.filter((item) => !item.includes('CLIENT_FETCH_ERROR') && !item.includes('Failed to fetch') && !item.includes('Failed to load resource'));
            if (consoleLeft.length) issues.push({ type: 'console', detail: consoleLeft.slice(0, 3).join(' | ') });
            const handled = /尚未|未接入|未返回|未连接|暂时没有|不展示|没有发现|没有可对照|时间线尚未|页面不存在|从团队档|不含季度|不画模拟/.test(text);
            const apiFails = failed.filter((item) => item.includes('/api/') && !item.includes('/api/auth/session'));
            if (apiFails.length && !handled) issues.push({ type: 'api', detail: apiFails.slice(0, 3).join(' | ') });
            let overflow = false;
            try {
                overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
            } catch {
                overflow = false;
            }
            if (overflow) issues.push({ type: 'overflow', detail: '横向溢出' });
            const english = englishHits(text.replace(/数据来自[^\n。]+。?/g, ''));
            if (english.length) issues.push({ type: 'english', detail: english.join(', ') });
            if (/lorem|placeholder text|TODO/i.test(text)) issues.push({ type: 'placeholder', detail: '占位文本' });
            const shot = issues.length ? `${session.role}-${viewport.name}${route.replaceAll('/', '_') || '_home'}.png` : '';
            if (shot) {
                await page.screenshot({ path: join(shotDir, shot), fullPage: false }).catch(() => undefined);
            }
            rows.push({ route, viewport: viewport.name, role: session.role, status, issues, shot });
            page.off('console', onConsole);
            page.off('response', onFailed);
        }
        await context.close();
    }
    }
    await browser.close();
    const byType = {};
    for (const row of rows) {
        for (const issue of row.issues) byType[issue.type] = (byType[issue.type] || 0) + 1;
    }
    const report = {
        generatedAt: new Date().toISOString(),
        base,
        routeCount: routes.length,
        roles: sessions.map((item) => item.role),
        checks: rows.length,
        issueCounts: byType,
        note: '五个角色使用种子账号的登录态访问。署名原文里的外文机构名不记为英文泄漏。浏览器对已解释的 403/404/503 只记页面是否说明原因。',
        rows,
    };
    writeFileSync(join(outDir, 'display_audit.json'), JSON.stringify(report, null, 2));
    const lines = [
        '# 显示巡检',
        '',
        `检查 ${routes.length} 条路由 × ${sessions.length} 个角色 × ${viewports.length} 个视口，共 ${rows.length} 次。`,
        '',
        '登录态来自五个种子账号。空白、崩溃、HTTP 错误、控制台错误和连续三个以上的英文词会记下来。浏览器对已经用中文说明的 4xx/5xx，以及署名段落里的外文原名，不单独记成显示故障。',
        '',
        '## 问题计数',
        '',
        ...Object.entries(byType).map(([key, value]) => `- ${key}: ${value}`),
        '',
        '## 有问题的页面',
        '',
    ];
    for (const row of rows.filter((item) => item.issues.length)) {
        lines.push(`- ${row.role} ${row.viewport} ${row.route}：${row.issues.map((issue) => `${issue.type} ${issue.detail}`).join('；')}`);
    }
    if (!rows.some((item) => item.issues.length)) lines.push('- 本次自动检查没有记下问题。');
    writeFileSync(join(outDir, '显示巡检.md'), lines.join('\n') + '\n');
    console.log(JSON.stringify({ routes: routes.length, checks: rows.length, issueCounts: byType }));
}

if ((process.argv[1] || '').endsWith('run_display_audit.mjs')) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
