/**
 * 审计 10-1：首访引导改为不遮挡主按钮的“提示气泡”。
 * - “不再显示”永久记住（localStorage）；“稍后”只在本次会话隐藏（sessionStorage）。
 * - 测算页（主按钮在页面下方）不弹出，避免盖住“开始计算”。
 */
export const TIP_DISMISSED_KEY = 'hasSeenOnboarding_v1';
export const TIP_SNOOZED_KEY = 'onboardingTipSnoozed_v1';

/** 主操作按钮位于页面底部/表单末尾的路由前缀：这些页面不弹提示 */
export const TIP_SUPPRESSED_PREFIXES = ['/calculator', '/quick-calc', '/checkout', '/onboarding', '/login'];

type KV = Pick<Storage, 'getItem'>;

export function shouldShowOnboardingTip(pathname: string | null | undefined, local: KV | null, session: KV | null): boolean {
  const path = pathname || '/';
  if (TIP_SUPPRESSED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (local?.getItem(TIP_DISMISSED_KEY)) return false;
  if (session?.getItem(TIP_SNOOZED_KEY)) return false;
  return true;
}
