import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/auth/sms-verify';

/**
 * 按来源限流：公开接口（不要求登录、或要消耗第三方额度 / 短信费用）的统一入口。
 *
 * 原来：
 * - 高德地图（/api/location、/api/location/suggestions）、天气与太阳辐射（/api/resource）、
 *   NREL、文献检索等公开接口完全没有任何限流，任何人写个循环就能把站点的第三方额度刷光；
 * - 唯一的限流器只服务短信接口：LRU 只装 500 个 key（换 IP 就能挤掉别人的计数），
 *   所有接口共用同一个 key 空间，也没有窗口概念，超限提示不告诉用户要等多久。
 *
 * 做法：固定窗口计数。已登录按用户计（额度更高），未登录按来源 IP 计。
 * 来源 IP 取网关（Caddy）追加在 X-Forwarded-For 末尾的那一跳——客户端自己带的前缀不可信。
 *
 * 局限（有意为之，写在这里而不是假装没有）：计数存在进程内存里。当前 compose 只起一个 web-cn
 * 实例，够用；将来横向扩容成多个实例，每个实例各算各的，实际上限是「单实例上限 × 实例数」，
 * 到那时应换成共享存储（Redis / 数据库）。重启会清零计数。
 */

export interface PublicToolRule {
  /** 规则名：不同接口互不占用额度 */
  name: string;
  /** 未登录：每个来源 IP 在一个窗口内最多几次 */
  anonymous: number;
  /** 已登录：每个用户在一个窗口内最多几次 */
  authenticated: number;
  windowMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** 各公开接口的额度。改数字请同步考虑第三方套餐的日额度。 */
export const PUBLIC_RULES = {
  /** 高德地图（地址补全、地理编码、周边）：输入框防抖后一分钟也就十来次 */
  amap: { name: 'amap', anonymous: 30, authenticated: 90, windowMs: MINUTE },
  /** 资源与天气查询：一次 type=all 会打 3 个上游 */
  resource: { name: 'resource', anonymous: 10, authenticated: 60, windowMs: MINUTE },
  /** NREL PVWatts（境外服务，且有严格的官方额度） */
  nrel: { name: 'nrel', anonymous: 10, authenticated: 30, windowMs: MINUTE },
  /** 文献检索（Semantic Scholar / arXiv / OpenAlex 等，上游自己也会限流） */
  papers: { name: 'papers', anonymous: 15, authenticated: 60, windowMs: MINUTE },
  /** 未登录也能用的测算入口：计算本身不花钱，限流是防拿 CPU 与电价接口做压测 */
  calculators: { name: 'calculators', anonymous: 30, authenticated: 120, windowMs: MINUTE },
  /** 官网「预约演示」表单：写库 + 让销售跟进，防灌水 */
  demoRequest: { name: 'demo-request', anonymous: 5, authenticated: 5, windowMs: HOUR },
  /** 短信发送：每条都要花钱，也能被拿去轰炸别人。分钟级 smsBurst，小时级 smsHourly */
  smsHourly: { name: 'sms-hourly', anonymous: 10, authenticated: 10, windowMs: HOUR },
  smsBurst: { name: 'sms-burst', anonymous: 3, authenticated: 3, windowMs: MINUTE },
} as const satisfies Record<string, PublicToolRule>;

interface Entry { count: number; resetAt: number }

export interface HitResult { limited: boolean; remaining: number; retryAfterSec: number }

export class FixedWindowLimiter {
  private entries = new Map<string, Entry>();

  constructor(private maxKeys = 20_000, private now: () => number = () => Date.now()) {}

  size(): number { return this.entries.size; }

  hit(key: string, limit: number, windowMs: number): HitResult {
    const now = this.now();
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      this.makeRoom(now);
      entry = { count: 0, resetAt: now + windowMs };
      this.entries.set(key, entry);
    }
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    // 被拒绝的请求不计数、不延长窗口
    if (entry.count >= limit) return { limited: true, remaining: 0, retryAfterSec };
    entry.count += 1;
    return { limited: false, remaining: limit - entry.count, retryAfterSec };
  }

  /** 表满时先清过期项；仍满则淘汰最早插入的，保证内存有上限。 */
  private makeRoom(now: number) {
    if (this.entries.size < this.maxKeys) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
    while (this.entries.size >= this.maxKeys) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

const shared = new FixedWindowLimiter();

export function limitedResponse(retryAfterSec: number): NextResponse {
  const message = `请求过于频繁，请 ${retryAfterSec} 秒后再试`;
  return NextResponse.json(
    // error 直接是中文：不少页面会把 error 字段原样显示给用户
    { success: false, code: 'RATE_LIMITED', error: message, message, retryAfterSeconds: retryAfterSec },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec), 'Cache-Control': 'no-store' } },
  );
}

/** NextAuth 的会话 cookie（HTTP / HTTPS 两种名字，大会话会被拆成 .0 .1 分片）。 */
const SESSION_COOKIE = /(?:^|[;\s])(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/;

/**
 * 没带会话 cookie 的请求（绝大多数匿名流量）直接当匿名处理，不去加载 NextAuth 与数据库客户端：
 * 既省一次会话解析，也让只测路由本身的单元测试不必连带初始化 Prisma。
 */
async function sessionUserId(req: Request): Promise<string | null> {
  if (!SESSION_COOKIE.test(req.headers.get('cookie') ?? '')) return null;
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([
      import('next-auth'),
      import('@/lib/auth/auth-options'),
    ]);
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 在路由处理函数最前面调用。返回 null 表示放行；返回 Response 则直接 return 它。
 *
 *   const limited = await enforceRateLimit(req, PUBLIC_RULES.amap);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  req: Request,
  rule: PublicToolRule,
  limiter: FixedWindowLimiter = shared,
): Promise<NextResponse | null> {
  const userId = await sessionUserId(req);
  const source = userId
    ? { key: `${rule.name}:u:${userId}`, limit: rule.authenticated }
    : {
        key: `${rule.name}:ip:${clientIp(req.headers.get('x-forwarded-for'), req.headers.get('x-real-ip'))}`,
        limit: rule.anonymous,
      };
  const result = limiter.hit(source.key, source.limit, rule.windowMs);
  return result.limited ? limitedResponse(result.retryAfterSec) : null;
}
