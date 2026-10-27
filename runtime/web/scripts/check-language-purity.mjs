// 国内版语言纯净度（白名单法）：扫描 src/app 与 src/components 中会显示给用户的文本
// （JSX 文本节点、含中文的字符串字面量、placeholder/title/alt/aria-label 属性），
// 统计不在白名单中的拉丁单词；单个文件超过 0 个即失败。国际版对应脚本见 runtime/web-int/scripts/check-claims.mjs（CJK > 0 即失败）。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { GLOSS_ON_FIRST, isAllowed } from './language-allowlist.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DIRS = ['src/app', 'src/components'].map((d) => join(ROOT, d));
const MAX = Number(process.env.LANGUAGE_PURITY_MAX ?? 0);
const walk = (d) => readdirSync(d).flatMap((n) => {
  const f = join(d, n);
  if (statSync(f).isDirectory()) return n === 'api' ? [] : walk(f); // API 路由另由 chinese-errors.test.ts 检查
  return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [f] : [];
});

const VISIBLE_ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label']);
const CJK = /[\u4e00-\u9fff]/;

/** 用 TypeScript AST 提取会显示给用户的文本：JSX 文本节点、可见属性值、含中文的字符串/模板字面量。 */
export function visibleSegments(src, fileName = 'x.tsx') {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const t = node.getText(sf).trim();
      if (t) out.push(t);
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (VISIBLE_ATTRS.has(node.name.getText(sf))) out.push(node.initializer.text);
      return; // className 等不可见属性跳过
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (CJK.test(node.text)) out.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
      if (CJK.test(parts)) out.push(parts);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function latinWords(seg) {
  const words = [];
  for (const w of seg.match(/[A-Za-z][A-Za-z0-9&/.-]*[A-Za-z0-9]|[A-Za-z]/g) ?? []) {
    const clean = w.replace(/[./-]+$/, '').replace(/&quot$/, '');
    if (clean === 'quot' || clean === 'nbsp' || clean === 'ldquo' || clean === 'rdquo') continue;
    words.push(clean);
  }
  return words;
}

export function offendingWords(src, fileName) {
  const words = [];
  const glossed = new Set();
  for (const seg of visibleSegments(src, fileName)) {
    const found = latinWords(seg);
    const hasCjk = CJK.test(seg);
    for (const clean of found) {
      const key = clean.toLowerCase();
      if (GLOSS_ON_FIRST.has(key) && !glossed.has(key)) {
        glossed.add(key);
        if (!hasCjk) words.push(clean);
      }
      if (!isAllowed(clean)) words.push(clean);
    }
  }
  return words;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = [];
  const report = [];
  for (const file of DIRS.flatMap(walk)) {
    const words = offendingWords(readFileSync(file, 'utf8'), file);
    if (words.length) report.push(`${relative(ROOT, file)}: ${words.length} → ${[...new Set(words)].slice(0, 12).join(', ')}`);
    if (words.length > MAX) failures.push(report[report.length - 1]);
  }
  if (process.env.LANGUAGE_PURITY_REPORT) console.log(report.join('\n'));
  if (failures.length) {
    console.error(`国内版语言纯净度：${failures.length} 个文件超过 ${MAX} 个非白名单拉丁词\n` + failures.join('\n'));
    process.exit(1);
  }
  console.log('国内版语言纯净度检查通过');
}
