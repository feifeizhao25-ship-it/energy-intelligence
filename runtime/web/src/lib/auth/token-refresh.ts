/**
 * NextAuth JWT 里的身份与会员等级只从数据库来。
 *
 * 原来 jwt 回调里有一句 `if (trigger === "update" && session) return { ...token, ...session.user }`。
 * 浏览器里 `useSession().update({ user: { id: '别人的id', plan: 'FULL' } })` 会 POST 到
 * /api/auth/session，这些字段原样进 token：
 * - 改 plan 就绕过付费墙（/api/chat 等按 session.user.plan 选模型、放额度）；
 * - 改 id 就成了别人——所有按 session.user.id 查数据的接口都认这个 id。
 * 另外 token 里的 plan 30 天不变：付款开通后要重新登录才生效，到期后仍按付费档。
 */

export interface DbUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  planExpireAt: Date | null;
  profileCompleted: boolean;
}

export interface AppToken {
  id?: string;
  plan?: string;
  phone?: string;
  profileCompleted?: boolean;
  name?: string | null;
  email?: string | null;
  refreshedAt?: number;
  [key: string]: unknown;
}

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** 已过期的付费档一律按免费档对待。 */
export function effectivePlan(plan: string | null | undefined, expireAt: Date | null | undefined, now = new Date()): string {
  if (!plan || plan === 'FREE') return 'FREE';
  if (expireAt && expireAt <= now) return 'FREE';
  return plan;
}

export function applyUser(token: AppToken, user: DbUser, now = Date.now()): AppToken {
  return {
    ...token,
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    plan: effectivePlan(user.plan, user.planExpireAt, new Date(now)),
    profileCompleted: user.profileCompleted,
    refreshedAt: now,
  };
}

/**
 * - 登录时（有 userId）：按库里的用户写入；
 * - 客户端调用 update() 时：**忽略客户端传来的任何字段**，只重新读库；
 * - 平时每 5 分钟重新读一次库，付款开通、到期、改资料都能及时生效；
 * - 库里找不到这个用户（已注销）：返回 null，调用方应让会话失效。
 */
export async function refreshToken(
  token: AppToken,
  opts: { userId?: string; trigger?: string; now?: number },
  loadUser: (id: string) => Promise<DbUser | null>,
): Promise<AppToken | null> {
  const now = opts.now ?? Date.now();
  const id = opts.userId ?? token.id;
  if (!id) return null;
  const stale = !token.refreshedAt || now - token.refreshedAt >= REFRESH_INTERVAL_MS;
  if (!opts.userId && opts.trigger !== 'update' && !stale) return token;
  const user = await loadUser(id);
  if (!user) return null;
  return applyUser(token, user, now);
}
