import { randomInt, timingSafeEqual } from 'node:crypto';

/**
 * 短信验证码的生成与校验（与数据库解耦，便于测试）。
 *
 * 原来：
 * - 验证码用 Math.random() 生成；
 * - 校验是 `findFirst({ phone, code, used:false })`：猜错不留痕迹，10 分钟有效期内
 *   可以对 /api/auth/callback/sms 无限次尝试 90 万个号码——登录只有短信一种方式，
 *   等于任何手机号的账号都能被穷举进入；
 * - 只能在 60 秒内限制重发，没有每日上限（花钱，也能拿来轰炸别人）。
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_INTERVAL_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const DAILY_LIMIT_PER_PHONE = 10;
export const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export function generateSmsCode(): string {
  return String(randomInt(100000, 1000000));
}

export interface CodeRecord {
  id: string;
  code: string;
  attempts: number;
  used: boolean;
  expiresAt: Date;
}

export interface CodeStore {
  latestActive(phone: string, now: Date): Promise<CodeRecord | null>;
  recordFailure(id: string, attempts: number, exhausted: boolean): Promise<void>;
  consume(id: string): Promise<boolean>;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

function sameCode(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 只看该手机号**最新一条**未用、未过期的验证码：错一次记一次，错满 5 次作废。
 * 成功时用条件更新消费（并发下同一验证码只能用一次）。
 */
export async function verifySmsCode(store: CodeStore, phone: string, code: string, now = new Date()): Promise<VerifyResult> {
  if (!PHONE_PATTERN.test(phone) || !/^\d{6}$/.test(code)) return { ok: false, reason: '验证码无效或已过期' };
  const record = await store.latestActive(phone, now);
  if (!record || record.used || record.expiresAt <= now || record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: '验证码无效或已过期' };
  }
  if (!sameCode(record.code, code)) {
    const attempts = record.attempts + 1;
    await store.recordFailure(record.id, attempts, attempts >= MAX_ATTEMPTS);
    return {
      ok: false,
      reason: attempts >= MAX_ATTEMPTS ? '验证码错误次数过多，请重新获取' : '验证码错误',
    };
  }
  const consumed = await store.consume(record.id);
  return consumed ? { ok: true } : { ok: false, reason: '验证码无效或已过期' };
}

/**
 * 取客户端地址用于限流。网关（Caddy）会把真实来源地址**追加**到 X-Forwarded-For 末尾，
 * 客户端自己带的前缀不可信；原来直接用整个头，伪造一个头就绕过了限流。
 */
export function clientIp(forwardedFor: string | null, realIp: string | null = null): string {
  const hops = (forwardedFor || '').split(',').map((s) => s.trim()).filter(Boolean);
  return hops[hops.length - 1] || realIp?.trim() || 'unknown';
}
