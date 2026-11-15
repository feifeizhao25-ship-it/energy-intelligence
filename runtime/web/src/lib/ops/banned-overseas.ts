/** 与 runtime/backend/ops/preflight.py 的 BANNED_OVERSEAS 对齐。空值不算已配置。名单在 json 里，本文件不发起境外请求。 */
import names from './banned-overseas.json';

export const BANNED_OVERSEAS: readonly string[] = names;

export function presentOverseas(env: Record<string, string | undefined> = process.env): string[] {
    return BANNED_OVERSEAS.filter((name) => Boolean(env[name]));
}
