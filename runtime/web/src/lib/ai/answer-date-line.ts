/**
 * 审计 8-3：每条 AI 回答底部固定显示“数据截至”日期行：
 * 引用来源的最新发布日期、核验（生成）日期、模型名称；涉及政策时提示以最新官方文件为准。
 */
const POLICY_RE = /政策|通知|办法|规定|规划|文件|公告|电价|补贴|发改|能源局|生态环境部/;

function pad(n: number) { return String(n).padStart(2, '0'); }

/** 从回答文本中抽取日期（YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日 / YYYY年M月），返回最新者（YYYY-MM-DD 或 YYYY-MM） */
export function latestCitedDate(text: string, now: Date = new Date()): string | null {
  const found: { key: number; label: string }[] = [];
  const re = /(20\d{2}|19\d{2})\s*(?:[-/.]|年)\s*(\d{1,2})\s*(?:(?:[-/.]|月)\s*(\d{1,2})\s*日?|月)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const y = Number(m[1]); const mo = Number(m[2]); const d = m[3] ? Number(m[3]) : 0;
    if (mo < 1 || mo > 12 || d > 31) continue;
    const key = y * 10000 + mo * 100 + d;
    const nowKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    if (key > nowKey) continue; // 未来日期（如规划目标年）不算来源发布日期
    found.push({ key, label: d ? `${y}-${pad(mo)}-${pad(d)}` : `${y}-${pad(mo)}` });
  }
  if (!found.length) return null;
  return found.sort((a, b) => b.key - a.key)[0].label;
}

export interface AnswerDateLine {
  sourceDate: string;
  verifiedDate: string;
  model: string;
  policyNotice: string | null;
  text: string;
}

export function buildAnswerDateLine(opts: { content: string; question?: string; model?: string | null; answeredAt: Date }): AnswerDateLine {
  const d = opts.answeredAt;
  const verifiedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sourceDate = latestCitedDate(opts.content, d) ?? '未引用带日期的来源';
  const model = opts.model?.trim() || '未知模型';
  const policyNotice = POLICY_RE.test(`${opts.question ?? ''}${opts.content}`) ? '涉及政策内容，请以最新官方文件为准' : null;
  const text = [`引用来源最新日期：${sourceDate}`, `核验日期：${verifiedDate}`, `模型：${model}`, policyNotice].filter(Boolean).join(' · ');
  return { sourceDate, verifiedDate, model, policyNotice, text };
}
