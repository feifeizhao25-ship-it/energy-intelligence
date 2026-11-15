import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

const SRC = join(__dirname, '..', '..');

function resolveImport(fromFile: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : join(dirname(fromFile), spec);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function importsOf(file: string): string[] {
  const found: string[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import type ') || trimmed.startsWith('export type ')) continue;
    const match = trimmed.match(/from\s+['"](@\/[^'"]+|\.[^'"]+)['"]/)
      || trimmed.match(/import\(\s*['"](@\/[^'"]+|\.[^'"]+)['"]\s*\)/);
    if (!match) continue;
    const resolved = resolveImport(file, match[1]);
    if (resolved) found.push(resolved);
  }
  return found;
}

function filesPullingFs(entry: string): string[] {
  const seen = new Set<string>();
  const hits: string[] = [];
  const stack = [entry];
  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    if (/from ['"](?:node:)?fs['"]/.test(text)) hits.push(file.slice(SRC.length + 1));
    for (const next of importsOf(file)) stack.push(next);
  }
  return hits;
}

test('助手页面的客户端依赖不再引入 fs', () => {
  const page = join(SRC, 'app/(dashboard)/assistant/page.tsx');
  expect(filesPullingFs(page)).toEqual([]);
  const failure = readFileSync(join(SRC, 'lib/assistant/chat-failure.ts'), 'utf8');
  expect(failure).not.toContain('library-fallback');
  expect(failure).not.toContain("from 'fs'");
  expect(failure).toContain('智能助手暂时连不上，请稍后再试');
  const pageSource = readFileSync(page, 'utf8');
  expect(pageSource).toContain('visibleAssistantError');
  expect(pageSource).toContain('ASSISTANT_UNREACHABLE_ZH');
  expect(pageSource).toContain('abortControllerRef.current?.abort()');
});
