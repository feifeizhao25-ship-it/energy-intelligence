import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 门禁：页面里发起的请求，必须真有对应的服务端接口 / 登录方式。
 *
 * 为什么要有：登录后端早已改成「手机号 + 短信验证码」（provider id 为 sms），登录页却仍在
 * signIn('credentials', {email, password}) 并请求不存在的 /api/auth/register——
 * 没有任何测试会红，结果线上谁也登录不了、注册不了。
 */
const SRC = join(__dirname, '..');
const API = join(SRC, 'app', 'api');

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : walk(p);
  return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
});

// 由 next.config 的 rewrite 转给后端的前缀、以及 next-auth 自己的端点
const REWRITTEN = ['/api/backend'];
const NEXTAUTH_ENDPOINTS = /^\/api\/auth\/(signin|signout|session|csrf|providers|callback|error|_log)(\/|$)/;

function routeDirs(): string[] {
  const out: string[] = [];
  const rec = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) rec(p);
      else if (n === 'route.ts') out.push(dir.slice(join(SRC, 'app').length));
    }
  };
  rec(API);
  return out;
}

export function apiPathResolves(path: string, routes: string[]): boolean {
  const clean = path.split('?')[0].replace(/\/+$/, '');
  if (REWRITTEN.some((p) => clean === p || clean.startsWith(`${p}/`))) return true;
  if (NEXTAUTH_ENDPOINTS.test(clean)) return true;
  const segs = clean.split('/');
  return routes.some((r) => {
    if (/\[\.\.\.\w+\]$/.test(r)) return false; // next-auth 的 catch-all 只认上面列出的端点，不能吞掉任意路径
    const rs = r.split('/');
    return rs.length === segs.length && rs.every((a, i) => a === segs[i] || (a.startsWith('[') && a.endsWith(']')) || segs[i].includes('${'));
  });
}

export function signInProviders(src: string): string[] {
  return [...src.matchAll(/\bsignIn\(\s*['"]([\w-]+)['"]/g)].map((m) => m[1]);
}

describe('页面与服务端的契约', () => {
  const files = walk(SRC).filter((p) => !p.startsWith(API));
  const routes = routeDirs();

  it('页面里写死的 /api/... 请求路径都有对应的路由', () => {
    const missing: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        for (const m of line.matchAll(/(['"`])(\/api\/[A-Za-z0-9_\-/${}.[\]]*)/g)) {
          const url = m[2].replace(/\/+$/, '');
          if (/^\/api\/?$/.test(url) || url === '/api/auth') continue; // 路径前缀，不是请求目标
          if (!apiPathResolves(url, routes)) missing.push(`${f.slice(SRC.length)}:${i + 1} ${url}`);
        }
      });
    }
    expect(missing).toEqual([]);
  });

  it('signIn(...) 用的登录方式都在 authOptions 里注册过', () => {
    const registered = [...readFileSync(join(SRC, 'lib', 'auth', 'auth-options.ts'), 'utf8').matchAll(/\bid:\s*["']([\w-]+)["']/g)].map((m) => m[1]);
    expect(registered).toContain('sms');
    const bad: string[] = [];
    for (const f of files) {
      for (const id of signInProviders(readFileSync(f, 'utf8'))) if (!registered.includes(id)) bad.push(`${f.slice(SRC.length)} signIn('${id}')`);
    }
    expect(bad).toEqual([]);
  });

  it('登录页确实用 sms 登录，并先请求发送验证码接口', () => {
    const src = readFileSync(join(SRC, 'app', 'login', 'login-form.tsx'), 'utf8');
    expect(signInProviders(src)).toEqual(['sms']);
    expect(src).toContain('/api/auth/sms');
  });

  it('门禁自检', () => {
    expect(apiPathResolves('/api/auth/register', routes)).toBe(false);
    expect(apiPathResolves('/api/auth/session', routes)).toBe(true);
    expect(apiPathResolves('/api/auth/sms', routes)).toBe(true);
    expect(apiPathResolves('/api/projects/${id}', routes)).toBe(true);
    expect(apiPathResolves('/api/nope/x', routes)).toBe(false);
    expect(apiPathResolves('/api/backend/entitlements', routes)).toBe(true);
    expect(signInProviders("signIn('credentials', {})")).toEqual(['credentials']);
    expect(existsSync(API)).toBe(true);
  });
});
