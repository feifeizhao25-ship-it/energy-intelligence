import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 门禁：国内版接口给用户的提示必须是中文。
 * 1) error / message / detail 等字段里不得出现英文句子（'Unauthorized'、'Failed to ...'、'Project not found'……）。
 *    大写下划线的错误码（UNAUTHORIZED）与不含空格的小写标识符是给程序看的，允许。
 * 2) 不得把 error.message 直接回给浏览器：fetch failed、HTTP 401、Prisma 报错都会原样露出。
 *    必须经过 safeErrorMessage(error, '中文兜底')。
 */
const API = join(__dirname);
const CJK = /[一-鿿]/;
const FIELD = /\b(error|message|msg|detail|reason|description|hint|note)\s*:\s*(['"`])((?:(?!\2).)*)\2/g;
const MACHINE_CODE = /^[A-Z][A-Z0-9_]+$|^[a-z0-9_\-.:/]+$/;

/** 不是给用户看的文本：写明原因才能加。 */
const ALLOW: { file: string; text: string; why: string }[] = [
  { file: '/membership/upgrade/route.ts', text: '${plan}-${billingPeriod}', why: '写入 payments.description 的内部订单备注，不会展示给用户' },
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

export function englishMessages(path: string, src: string): string[] {
  const out: string[] = [];
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /console\.(error|warn|log|info)/.test(line)) return;
    for (const m of line.matchAll(FIELD)) {
      const value = m[3];
      if (CJK.test(value) || !/[A-Za-z]{3}/.test(value) || MACHINE_CODE.test(value)) continue;
      if (ALLOW.some((a) => path.endsWith(a.file) && a.text === value)) continue;
      out.push(`${path}:${i + 1} ${value}`);
    }
  });
  return out;
}

const RAW_ERROR = /\b(?:error|err|e|apiError)\s*(?:as \w+\)?)?\.message\b/;
const NOT_A_RESPONSE = /console\.|safeErrorMessage|===|!==|\.includes\(|\.startsWith\(|\.match\(|\.test\(|throw new/;

export function rawErrorMessages(path: string, src: string): string[] {
  const out: string[] = [];
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || NOT_A_RESPONSE.test(line)) return;
    if (RAW_ERROR.test(line)) out.push(`${path}:${i + 1} ${line.trim()}`);
  });
  return out;
}

/** 形如 NEXTAUTH_SECRET、AMAP_WEB_SERVICE_KEY、DATABASE_URL 的环境变量名 */
const ENV_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:SECRET|KEY|URL)\b/;
/** 一行里的字符串字面量（'…'、"…"、`…`）与 JSX 文本（>…<） */
const LITERAL = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`|>([^<>{}]+)</g;

/**
 * 页面静态文案与接口提示里出现的环境变量名。process.env.X 这种代码引用不算，只看给人看的字符串和 JSX 文本。
 */
export function envNamesInCopy(path: string, src: string): string[] {
  const out: string[] = [];
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /console\.(error|warn|log|info)/.test(line)) return;
    const code = line.replace(/\b(?:process\.)?env\.[A-Z0-9_]+/g, '');
    for (const m of code.matchAll(LITERAL)) {
      const text = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
      const hit = text.match(ENV_NAME);
      if (hit) out.push(`${path}:${i + 1} ${hit[0]}`);
    }
  });
  return out;
}

describe('接口提示全中文', () => {
  const all = files(API).map((p) => ({ path: p.slice(API.length), src: readFileSync(p, 'utf8') }));

  it('扫描到了足够多的路由', () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it('error/message 字段里没有英文句子', () => {
    expect(all.flatMap((f) => englishMessages(f.path, f.src))).toEqual([]);
  });

  it('没有把 error.message 直接回给浏览器', () => {
    expect(all.flatMap((f) => rawErrorMessages(f.path, f.src))).toEqual([]);
  });

  it('页面上不直接显示 err.message（断网时浏览器给的是英文 Failed to fetch）', () => {
    const SRC = join(__dirname, '..', '..');
    const ui = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) return n === 'api' || n === 'node_modules' ? [] : walk(p);
        return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
      });
    })(SRC);
    const bad = ui.flatMap((p) => readFileSync(p, 'utf8').split('\n').flatMap((line, i) =>
      /\bset\w*\(\s*(?:error|err|e|cause)\.message\s*\)|\{\s*(?:error|err|e|cause)\.message\s*\}/.test(line) && !/console\./.test(line) ? [`${p.slice(SRC.length)}:${i + 1}`] : []));
    expect(ui.length).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });

  it('页面静态文案和接口提示里不出现环境变量名（如 NEXTAUTH_SECRET）', () => {
    const SRC = join(__dirname, '..', '..');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : walk(p);
      return /\.(tsx|ts)$/.test(n) && !/\.(test|spec)\./.test(n) && !/\.d\.ts$/.test(n) ? [p] : [];
    });
    const targets = [...walk(join(SRC, 'app')), ...walk(join(SRC, 'components'))];
    expect(targets.length).toBeGreaterThan(100);
    const bad = targets.flatMap((p) => envNamesInCopy(p.slice(SRC.length), readFileSync(p, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('门禁自检：能抓出文案里的环境变量名，放过代码引用和普通常量名', () => {
    expect(envNamesInCopy('/x', "authNotConfigured: '缺少环境变量（NEXTAUTH_URL / NEXTAUTH_SECRET）',")).toHaveLength(1);
    expect(envNamesInCopy('/x', '<p>请配置 AMAP_WEB_SERVICE_KEY 后重试</p>')).toHaveLength(1);
    expect(envNamesInCopy('/x', 'message: `缺少 ${name}：ALIPAY_PRIVATE_KEY`')).toHaveLength(1);
    expect(envNamesInCopy('/x', "const key = process.env.AMAP_WEB_SERVICE_KEY || '';")).toEqual([]);
    expect(envNamesInCopy('/x', "localStorage.setItem(MILESTONE_STORAGE_KEY, 'true');")).toEqual([]);
    expect(envNamesInCopy('/x', "authNotConfigured: '登录服务维护中，请稍后再试。',")).toEqual([]);
  });

  it('门禁自检：能抓出英文提示和原样回传', () => {
    expect(englishMessages('/x', "NextResponse.json({ error: 'Unauthorized' })")).toHaveLength(1);
    expect(englishMessages('/x', "NextResponse.json({ error: 'Failed to load', message: `Unknown: ${a}` })")).toHaveLength(2);
    expect(englishMessages('/x', "NextResponse.json({ error: 'UNAUTHORIZED', message: '请先登录' })")).toEqual([]);
    expect(rawErrorMessages('/x', "return NextResponse.json({ error: error.message }, { status: 500 });")).toHaveLength(1);
    expect(rawErrorMessages('/x', "message: error instanceof Error ? error.message : '失败'")).toHaveLength(1);
    expect(rawErrorMessages('/x', "message: safeErrorMessage(error, '失败')")).toEqual([]);
  });
});
