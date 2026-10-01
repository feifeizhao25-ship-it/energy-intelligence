/**
 * 当前生效的《服务条款》《隐私政策》版本（取文本页上的「生效日期」）。
 * 改了条款或隐私政策正文，必须同步改这里——consent.test.ts 会核对页面上的日期与这里一致。
 * 登录时用户勾选同意，库里记下 termsAcceptedAt 与 termsVersion 作为同意凭证。
 */
export const LEGAL_VERSION = '2026-08-22';

export const CONSENT_REQUIRED_MESSAGE = '请先阅读并同意《服务条款》和《隐私政策》';

export function consentRecord(now: Date = new Date()) {
  return { termsAcceptedAt: now, termsVersion: LEGAL_VERSION };
}
