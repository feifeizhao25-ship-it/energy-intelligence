// 审计 4-2：运行时语言检查改为白名单制——页面可见文本里的拉丁词必须在 language-allowlist.mjs 中，
// 不再只靠一份“已知英文短语”黑名单（黑名单漏掉新加的英文）。
import { isAllowed } from './language-allowlist.mjs';

export const RUNTIME_MAX_NON_ALLOWLISTED = Number(process.env.LANGUAGE_PURITY_MAX ?? 0);

// 保留旧黑名单作为硬失败（出现即失败，不计入阈值）
export const ENGLISH_MARKERS = ['Energy Intelligence', 'Terms of Service', 'Privacy Policy', 'Request a quote', 'Back to plans', 'Order review', 'Switch to English'];

export function nonAllowlistedWords(text) {
  const out = [];
  const stripped = text.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+/g, " ");
  for (const w of stripped.match(/(?<![0-9])[A-Za-z][A-Za-z0-9&/.-]*[A-Za-z0-9]|[A-Za-z]/g) ?? []) {
    const clean = w.replace(/[./-]+$/, '');
    if (/^(https?:|www\.)/i.test(clean) || /@/.test(clean)) continue;
    // 构建时写入的提交号是十六进制，不是英文单词。
    if (/^[0-9a-f]{7,40}$/i.test(clean)) continue;
    if (!isAllowed(clean)) out.push(clean);
  }
  return out;
}

/** 返回该页面的问题列表（空数组 = 通过） */
export function analyzeVisibleText(route, text, max = RUNTIME_MAX_NON_ALLOWLISTED) {
  const problems = [];
  if (!/[㐀-鿿]/.test(text)) problems.push(`${route}: 页面没有中文`);
  for (const m of ENGLISH_MARKERS) if (text.includes(m)) problems.push(`${route}: 出现英文文案「${m}」`);
  const bad = nonAllowlistedWords(text);
  if (bad.length > max) {
    problems.push(`${route}: ${bad.length} 个非白名单拉丁词（上限 ${max}）→ ${[...new Set(bad)].slice(0, 12).join(', ')}`);
  }
  return problems;
}
