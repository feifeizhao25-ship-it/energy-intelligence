/** 国内模型后端连不上时给用户看的话。不要写成「未知错误」。 */
export const ASSISTANT_UNREACHABLE_ZH = '智能助手暂时连不上，请稍后再试';

function errorChain(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current) && parts.length < 8) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.name, current.message);
      const code = (current as { code?: unknown }).code;
      if (typeof code === 'string' && code) parts.push(code);
      current = current.cause;
      continue;
    }
    const record = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof record.code === 'string' && record.code) parts.push(record.code);
    if (typeof record.message === 'string' && record.message) parts.push(record.message);
    current = record.cause;
  }
  if (!parts.length && error != null) parts.push(String(error));
  return parts.join(' ');
}

export function isModelUnconfigured(error: unknown): boolean {
  return /未配置|拒绝生成替代内容|not configured/i.test(errorChain(error));
}

/** 网络错误、连接被拒绝、域名解析失败。国内模型后端没连上时走这条。 */
export function isModelUnreachable(error: unknown): boolean {
  return /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|EPIPE|fetch failed|failed to fetch|network|socket hang up|UND_ERR_|other side closed|connect ECONN/i.test(errorChain(error));
}

/** 界面上不要出现「未知错误」或英文网络报错。 */
export function visibleAssistantError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed || trimmed === '未知错误') return ASSISTANT_UNREACHABLE_ZH;
  if (/API_KEY/.test(trimmed)) return 'AI 服务暂时不可用，请稍后再试';
  if (isModelUnreachable(trimmed)) return ASSISTANT_UNREACHABLE_ZH;
  return trimmed;
}
