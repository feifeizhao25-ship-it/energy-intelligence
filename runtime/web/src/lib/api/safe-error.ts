/**
 * 把捕获到的异常转成「可以给用户看」的中文提示。
 *
 * 原来很多路由直接 `error.message` 回给浏览器：fetch 失败会露出 "fetch failed"、
 * 上游返回 "HTTP 401"、Prisma 报错会带出 SQL 与表结构，国内版用户看到的是英文原始报错，
 * 还泄露内部实现。
 *
 * 规则：只有「我们自己用中文写的业务错误」才原样给用户（含中文、不长、不像数据库/堆栈信息）；
 * 其余一律用调用方给的中文兜底文案。原始异常请调用方自己 console.error。
 */
const CJK = /[一-鿿]/;
const LOOKS_INTERNAL = /prisma|invalid `|\bat\s+\S+\s+\(|\bECONN|ETIMEDOUT|ENOTFOUND|SQLSTATE|stack|node_modules|\.tsx?:\d+|HTTP \d{3}|Error:/i;

export function safeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 200) return fallback;
  if (!CJK.test(trimmed) || LOOKS_INTERNAL.test(trimmed)) return fallback;
  return trimmed;
}
