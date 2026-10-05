import { PHONE_PATTERN } from './phone';
import { safeErrorMessage } from '@/lib/api/safe-error';

/** 登录页用到的纯逻辑（与界面分开，便于测试）。 */

export const RESEND_SECONDS = 60;

export function isValidPhone(input: string): boolean {
  return PHONE_PATTERN.test(input.trim());
}

/** 只保留数字，最多 n 位——输入框里粘贴「138 0000 0000」也能用。 */
export function digitsOnly(input: string, max: number): string {
  return input.replace(/\D/g, '').slice(0, max);
}

/**
 * next-auth 登录失败时 result.error 是我们在 authorize 里抛的中文原因；
 * 配置/网络问题时可能是 "CredentialsSignin"、"Configuration"、"fetch failed" 等英文，换成中文兜底。
 */
export function loginErrorMessage(raw: string | null | undefined): string {
  return safeErrorMessage(raw ? new Error(raw) : null, '登录失败，请检查手机号和验证码后重试');
}

/** 发送验证码接口的失败原因：接口自己返回中文 error（频繁、已达上限、手机号无效……）。 */
export function sendCodeErrorMessage(payload: unknown, status: number): string {
  const error = (payload as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return safeErrorMessage(new Error(error), fallbackFor(status));
  return fallbackFor(status);
}

function fallbackFor(status: number): string {
  if (status === 429) return '发送太频繁，请稍后再试';
  return '验证码发送失败，请稍后重试';
}
