import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { aigcJson, aigcMeta, AIGC_HEADER, AIGC_LABEL } from './aigc';

describe('AIGC 隐式标识', () => {
  it('aigcJson：响应体带 aigc 元数据，响应头带 X-AIGC-Generated', async () => {
    const res = aigcJson({ success: true, data: 'x' }, { status: 200, model: 'deepseek-v3' });
    expect(res.headers.get(AIGC_HEADER)).toBe('1');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.aigc).toMatchObject({ generated: true, label: AIGC_LABEL, model: 'deepseek-v3' });
    expect(new Date(body.aigc.generatedAt).getTime()).not.toBeNaN();
  });

  it('保留调用方的状态码与自定义响应头', () => {
    const res = aigcJson({ a: 1 }, { status: 201, headers: { 'X-Foo': 'bar' } });
    expect(res.status).toBe(201);
    expect(res.headers.get('X-Foo')).toBe('bar');
    expect(res.headers.get(AIGC_HEADER)).toBe('1');
  });

  it('标识语是中文，明确说明是人工智能生成', () => {
    expect(aigcMeta().label).toMatch(/人工智能生成/);
  });
});

/**
 * 门禁：AI 生成内容必须带标识。
 * - 服务端：调用大模型的路由（引入 unified / papers/ai / tool-executor / assistant agent）必须出 aigcJson / AIGC_HEADER。
 * - 页面端：请求这些接口的组件必须渲染 AigcLabel。
 * 原来用户条款写了「AI 生成内容可能包含显式及隐式标识」，页面和接口里一处标识都没有。
 */
const SRC = join(__dirname, '..', '..');
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : walk(p);
  return /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
});

const AI_IMPORT = /from ['"]@\/lib\/(ai\/unified|ai\/tool-executor|papers\/ai|assistant\/agent|ai\/router)['"]/;
const SERVER_MARK = /aigcJson\(|AIGC_HEADER|aigcMeta\(/;
const AI_ENDPOINT = /['"`]\/api\/(chat|papers\/ai|papers\/chat|papers\/research-assistant|papers\/analyze-search|calculator\/analysis|projects\/diagnosis|ai\/tool|maintenance)['"`?]/;
const CLIENT_MARK = /<AigcLabel\b/;

// 只算「真的用了」：把 import 行去掉再匹配，光引入不调用不算数
const withoutImports = (src: string) => src.replace(/^import .*$/gm, '');
export const unlabeledRoutes = (files: { path: string; src: string }[]) =>
  files.filter((f) => /\/route\.ts$/.test(f.path) && AI_IMPORT.test(f.src) && !SERVER_MARK.test(withoutImports(f.src))).map((f) => f.path);
export const unlabeledClients = (files: { path: string; src: string }[]) =>
  files.filter((f) => /\.tsx$/.test(f.path) && AI_ENDPOINT.test(f.src) && !CLIENT_MARK.test(f.src)).map((f) => f.path);

describe('AI 生成内容标识门禁', () => {
  const files = walk(SRC).map((p) => ({ path: p.slice(SRC.length), src: readFileSync(p, 'utf8') }));

  it('调用大模型的接口都带隐式标识', () => {
    expect(files.filter((f) => AI_IMPORT.test(f.src) && /\/route\.ts$/.test(f.path)).length).toBeGreaterThanOrEqual(8);
    expect(unlabeledRoutes(files)).toEqual([]);
  });

  it('展示 AI 内容的页面都有显式标识', () => {
    expect(files.filter((f) => AI_ENDPOINT.test(f.src) && /\.tsx$/.test(f.path)).length).toBeGreaterThanOrEqual(3);
    expect(unlabeledClients(files)).toEqual([]);
  });

  it('门禁自检：缺标识会被抓出来', () => {
    expect(unlabeledRoutes([{ path: '/a/route.ts', src: "import { simpleChat } from '@/lib/ai/unified';\nNextResponse.json({})" }])).toEqual(['/a/route.ts']);
    expect(unlabeledRoutes([{ path: '/a/route.ts', src: "import { simpleChat } from '@/lib/ai/unified';\nreturn aigcJson({})" }])).toEqual([]);
    // 只 import 不使用，不算
    expect(unlabeledRoutes([{ path: '/a/route.ts', src: "import { simpleChat } from '@/lib/ai/unified';\nimport { aigcJson } from '@/lib/ai/aigc';\nreturn NextResponse.json({})" }])).toEqual(['/a/route.ts']);
    expect(unlabeledClients([{ path: '/c.tsx', src: "fetch('/api/chat')" }])).toEqual(['/c.tsx']);
    expect(unlabeledClients([{ path: '/c.tsx', src: "fetch('/api/chat'); <AigcLabel />" }])).toEqual([]);
  });
});
