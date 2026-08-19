/**
 * 前端调用路径 ↔ Next 路由的契约检查（静态扫描）。
 *
 * 2026-08-18 复核发现两条断链，都不是「功能没做」，而是**接线没接上**：
 *
 *   /api/calculate/solar
 *     `calculate/wind`、`calculate/storage`、`calculate/comparison` 三个兄弟都在，
 *     唯独 solar 缺席，而 `ConversationalWizard` 一直在打它。
 *     计算器 `lib/calculator/solar.ts` 早就写好了。
 *     404 被 catch 吞掉后静默跳回旧结果页 —— 用户看到过时静态页面，
 *     表现成「功能怪怪的」而非「接口不存在」。
 *
 *   /api/ai/tool
 *     工具执行器（40+ 个工具）与白名单都齐了，缺的只是入口。
 *     `SiteWizard` 打 404 之后，`setAiExplanation(aiData.output || aiData)`
 *     会把 Next 的 404 页面对象直接当解释渲染出去。
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_SRC = path.resolve(__dirname, '../..');
const API_ROOT = path.join(WEB_SRC, 'app', 'api');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      out.push(...walk(full));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(spec|test)\./.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

function localRoutes(): string[] {
  const routes: string[] = [];
  const visit = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    if (fs.existsSync(path.join(dir, 'route.ts'))) routes.push(prefix);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(path.join(dir, entry.name), `${prefix}/${entry.name}`);
    }
  };
  visit(API_ROOT, '/api');
  return routes;
}

/** Next 的动态段：[id] 匹配一段，[...slug] 匹配多段 */
function routeToRegex(route: string): RegExp {
  const parts = route
    .replace(/^\//, '')
    .split('/')
    .map((seg) => {
      if (/^\[\.\.\..+\]$/.test(seg)) return '.+';
      if (/^\[.+\]$/.test(seg)) return '[^/]+';
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
  return new RegExp(`^/${parts.join('/')}(/|$)`);
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('前端 /api 调用必须有对应路由', () => {
  const routes = localRoutes();
  const matchers = routes.map(routeToRegex);

  it('扫描到了路由表', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it('没有无人承接的调用', () => {
    const orphans: string[] = [];
    for (const file of walk(path.join(WEB_SRC))) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      const re = /fetch\(\s*[`'"](\/api\/[^`'"?\s]*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        // 模板插值当成一个动态段
        const normalized = m[1].replace(/\$\{[^}]*\}/g, 'X');
        if (!matchers.some((rx) => rx.test(normalized))) {
          orphans.push(`${m[1]}  <- ${path.relative(WEB_SRC, file)}`);
        }
      }
    }
    expect(orphans.length === 0 ? '' : `无人承接的调用:\n  ${orphans.join('\n  ')}`).toBe('');
  });
});

describe('新补的两个路由', () => {
  it('/api/calculate/solar 存在且补齐了兄弟路由', () => {
    ['solar', 'wind', 'storage', 'comparison'].forEach((kind) => {
      expect(fs.existsSync(path.join(API_ROOT, 'calculate', kind, 'route.ts'))).toBe(true);
    });
  });

  it('solar 用真实电价而非前端传来的默认值', () => {
    const src = fs.readFileSync(path.join(API_ROOT, 'calculate/solar/route.ts'), 'utf8');
    // 前端注释写明「will be updated by API」，服务端必须真的去取
    expect(src).toContain('getLatestPrice');
    // 并把新鲜度带回去，让 UI 能提示「基于 X 天前的备份电价」
    expect(src).toContain('stale');
  });

  it('solar 在电价缺失时报错而不是套用邻省价格', () => {
    const src = fs.readFileSync(path.join(API_ROOT, 'calculate/solar/route.ts'), 'utf8');
    expect(src).toContain('PRICE_UNAVAILABLE');
  });

  it('/api/ai/tool 存在', () => {
    expect(fs.existsSync(path.join(API_ROOT, 'ai/tool/route.ts'))).toBe(true);
  });

  it('/api/ai/tool 按白名单放行，不直接透传 toolName', () => {
    const src = fs.readFileSync(path.join(API_ROOT, 'ai/tool/route.ts'), 'utf8');
    // executeTool 是个大 switch，含写操作；不过白名单等于全部对外开放
    expect(src).toContain('isToolAllowed');
    expect(src).toContain('TOOL_NOT_ALLOWED');
  });

  it('/api/ai/tool 拒绝需要确认的高风险工具', () => {
    const src = fs.readFileSync(path.join(API_ROOT, 'ai/tool/route.ts'), 'utf8');
    // 这个通用入口没有确认流程，放行等于绕过确认
    expect(src).toContain('requiresConfirmation');
    expect(src).toContain('CONFIRMATION_REQUIRED');
  });

  it('/api/ai/tool 要求登录', () => {
    const src = fs.readFileSync(path.join(API_ROOT, 'ai/tool/route.ts'), 'utf8');
    expect(src).toContain('getServerSession');
  });

  it('/api/ai/tool 不把工具错误当成功结果返回', () => {
    const src = fs.readFileSync(path.join(API_ROOT, 'ai/tool/route.ts'), 'utf8');
    // executeTool 的约定是把错误放进返回值而不抛异常；
    // 直接 200 会让前端把错误对象当结果渲染
    expect(src).toMatch(/'error' in/);
  });
});

describe('SiteWizard 用到的工具已登记白名单', () => {
  it('explain_site_recommendation 与 geocode_address 均已登记', () => {
    const src = fs.readFileSync(
      path.join(WEB_SRC, 'lib/audit/tool-whitelist.ts'),
      'utf8',
    );
    // 两者在 tool-executor 里早已实现，但从未登记 ——
    // 新入口按白名单放行，不登记就是 403
    expect(src).toContain('explain_site_recommendation:');
    expect(src).toContain('geocode_address:');
  });

  it('登记为只读且无需确认，才能走通用入口', () => {
    const src = fs.readFileSync(
      path.join(WEB_SRC, 'lib/audit/tool-whitelist.ts'),
      'utf8',
    );
    ['explain_site_recommendation', 'geocode_address'].forEach((tool) => {
      const start = src.indexOf(`${tool}: {`);
      expect(start).toBeGreaterThan(-1);
      const block = src.slice(start, start + 900);
      expect(block).toContain("riskLevel: 'READ_ONLY'");
      expect(block).toContain('requiresConfirmation: false');
      expect(block).toContain('enabled: true');
    });
  });
});
