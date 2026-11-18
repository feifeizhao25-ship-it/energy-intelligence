/**
 * 新能源智库国内版 · 全站只读周漏斗。
 *
 * 只读、只出全站合计：不出用户编号、手机号、邮箱、订单号，也不按用户拆分。
 * 数据都在 web 的库（energy_web，Prisma）里：
 * - 新注册：users.createdAt（短信验证码首次登录即建号，见 lib/auth/auth-options.ts authorizeSms）。
 * - 付款：payments，status = 'completed'、currency = 'CNY'，按 paidAt 计（微信 / 支付宝回调写入）。
 * - 到期：subscriptions.endDate。每个用户只有一条订阅，续费时回调把 endDate 往后推。
 * - 退款：代码里没有任何地方把订单改成 refunded，也没有退款时间字段（退款只有测算和人工咨询），返回 null。
 * - 注册来源：#173 的 signup_source_events 表；表不存在（未合入 / 未迁移）时返回 null。
 * 后端 FastAPI 自己的 users / payment_orders 在另一个库（energy_api），国内入口不对外开放，不读。
 */
import { createHash, timingSafeEqual } from 'crypto';

export const READONLY_TOKEN_ENV = 'ENERGY_FUNNEL_READONLY_TOKEN';
/** 只读令牌不能和这些已有口令相同；相同就当作没开。 */
export const FORBIDDEN_TOKEN_REUSE_ENVS = [
    'NENGJIAN_INTERNAL_TOKEN',
    'CRON_SECRET',
    'NEXTAUTH_SECRET',
    'CORE_API_KEY',
    'ADMIN_TOKEN',
    'ADMIN_API_KEY',
] as const;

export const DEFAULT_WEEKS = 4;
export const MAX_WEEKS = 26;
export const SOURCE_TABLE = 'signup_source_events';
const SHANGHAI_OFFSET_MS = 8 * 3600 * 1000; // 固定 +08:00，无夏令时
const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const WEEK_DEFINITION = '上海时间（UTC+8）周日 00:00:00 至周六 23:59:59';

export const FIELD_NOTES: Record<string, string> = {
    new_signups: 'users 表按 createdAt 计：短信验证码首次登录即建号。已注销（匿名化保留）的账号仍按建号时间计入。',
    new_paid: '本周第一次付款成功（payments.status = completed，CNY）的用户数，按用户去重。',
    renewals: '本周付款成功、且此前已经付过款的订单数（续费、换档再付款都算）。',
    order_amount_fen: '本周付款成功的 CNY 订单金额合计，单位分（payments.amount 元 × 100），未扣退款。',
    refund_amount_fen: '暂无数据：代码里没有任何地方把订单改成 refunded，payments 也没有退款时间字段；退款目前只有测算（/api/membership/refund/quote）和人工处理。',
    expirations: '订阅到期日（subscriptions.endDate）落在本周且已经过去的订阅数。每个用户只有一条订阅、续费会把到期日往后推，所以过去某周到期后又续上的人看不到，过去的周是下限。',
    signups_by_source: '按 #173 的注册来源题统计本周新注册（代码 → 人数，另有 unanswered = 没答的人数）。',
};
export const SOURCE_TABLE_MISSING_NOTE =
    '暂无数据：注册来源表 signup_source_events 不存在（#173 未合入或未迁移），不是 0。';

/** 参数不合法。reason 是给调用方看的中文说明（422）。 */
export class WeekError extends Error {
    constructor(readonly reason: string) {
        super(reason);
        this.name = 'WeekError';
    }
}

export function shanghaiIso(ms: number): string {
    const local = new Date(ms + SHANGHAI_OFFSET_MS).toISOString(); // 2026-11-15T00:00:00.000Z
    return local.slice(0, 19) + '+08:00';
}

/** moment 所在周的周日 00:00（上海时间），返回 UTC 毫秒。 */
export function weekStartOf(moment: Date): number {
    const localMs = moment.getTime() + SHANGHAI_OFFSET_MS;
    const local = new Date(localMs);
    const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    return dayStart - local.getUTCDay() * DAY_MS - SHANGHAI_OFFSET_MS;
}

export function parseWeekStart(value: string | null, now: Date): number {
    if (value === null || value === '') return weekStartOf(now);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) throw new WeekError('week_start 需要 YYYY-MM-DD 格式的日期');
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const utc = new Date(Date.UTC(y, mo - 1, d));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) {
        throw new WeekError('week_start 不是有效日期');
    }
    if (utc.getUTCDay() !== 0) throw new WeekError('week_start 必须是周日（上海时间）');
    return utc.getTime() - SHANGHAI_OFFSET_MS;
}

export function parseWeeks(value: string | null): number {
    if (value === null || value === '') return DEFAULT_WEEKS;
    if (!/^\d+$/.test(value)) throw new WeekError(`weeks 需要 1 到 ${MAX_WEEKS} 之间的整数`);
    const n = Number(value);
    if (n < 1 || n > MAX_WEEKS) throw new WeekError(`weeks 需要 1 到 ${MAX_WEEKS} 之间的整数`);
    return n;
}

export type WeekRange = { start: number; end: number };

export function weekRanges(lastStart: number, weeks: number): WeekRange[] {
    const out: WeekRange[] = [];
    for (let back = weeks - 1; back >= 0; back--) {
        const start = lastStart - back * WEEK_MS;
        out.push({ start, end: start + WEEK_MS });
    }
    return out;
}

/** 金额（元，Decimal / 字符串 / 数字）转分。按字符串处理，避免浮点误差。 */
export function yuanToFen(value: unknown): number {
    const text = String(value ?? '').trim();
    const m = /^(-?)(\d+)(?:\.(\d{0,2})\d*)?$/.exec(text);
    if (!m) return 0;
    const fen = Number(m[2]) * 100 + Number((m[3] || '').padEnd(2, '0'));
    return m[1] === '-' ? -fen : fen;
}

export type PaymentRow = { payer: string; key: string; paidAt: Date; amountFen: number };

export interface FunnelSource {
    countSignups(start: Date, end: Date): Promise<number>;
    /** 截至 before（不含）的全部已完成 CNY 付款。 */
    completedPayments(before: Date): Promise<PaymentRow[]>;
    /** 到期日在 [from, to) 的订阅到期日。 */
    subscriptionEndDates(from: Date, to: Date): Promise<Date[]>;
    /** 来源表不存在时返回 null。 */
    signupSources(start: Date, end: Date): Promise<Record<string, number> | null>;
}

export type WeekRow = {
    week_start: string;
    week_end: string;
    complete: boolean;
    new_signups: number;
    new_paid: number;
    renewals: number;
    order_amount_fen: number;
    refund_amount_fen: null;
    expirations: number;
    signups_by_source: Record<string, number> | null;
};

export type FunnelReport = {
    scope: 'site';
    market: 'cn';
    timezone: 'Asia/Shanghai';
    week_definition: string;
    currency: 'CNY';
    money_unit: '分';
    generated_at: string;
    weeks: WeekRow[];
    field_notes: Record<string, string>;
};

/** 查数据库之前先校验参数；不合法直接抛 WeekError（422），不开事务。 */
export function checkParams(params: { weekStart: string | null; weeks: string | null }, now: Date = new Date()): void {
    const last = parseWeekStart(params.weekStart, now);
    parseWeeks(params.weeks);
    if (last > weekStartOf(now)) throw new WeekError('week_start 不能晚于本周');
}

export async function buildReport(
    source: FunnelSource,
    params: { weekStart: string | null; weeks: string | null },
    now: Date = new Date(),
): Promise<FunnelReport> {
    const last = parseWeekStart(params.weekStart, now);
    const count = parseWeeks(params.weeks);
    if (last > weekStartOf(now)) throw new WeekError('week_start 不能晚于本周');
    const ranges = weekRanges(last, count);
    const first = ranges[0].start;
    const lastEnd = ranges[ranges.length - 1].end;
    const nowMs = now.getTime();

    const payments = (await source.completedPayments(new Date(lastEnd)))
        .slice()
        .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const firstKey = new Map<string, string>();
    const firstAt = new Map<string, number>();
    for (const p of payments) {
        if (!firstKey.has(p.payer)) {
            firstKey.set(p.payer, p.key);
            firstAt.set(p.payer, p.paidAt.getTime());
        }
    }
    const expiryUpper = Math.min(lastEnd, nowMs);
    const endDates = expiryUpper > first
        ? (await source.subscriptionEndDates(new Date(first), new Date(expiryUpper))).map((d) => d.getTime())
        : [];

    const notes = { ...FIELD_NOTES };
    const weeks: WeekRow[] = [];
    for (const { start, end } of ranges) {
        const inWeek = (ms: number) => ms >= start && ms < end;
        const weekPayments = payments.filter((p) => inWeek(p.paidAt.getTime()));
        const signups = await source.countSignups(new Date(start), new Date(end));
        const sources = await source.signupSources(new Date(start), new Date(end));
        let bySource: Record<string, number> | null = null;
        if (sources === null) {
            notes.signups_by_source = SOURCE_TABLE_MISSING_NOTE;
        } else {
            const answered = Object.values(sources).reduce((a, b) => a + b, 0);
            bySource = { ...sources, unanswered: Math.max(signups - answered, 0) };
        }
        const upper = Math.min(end, nowMs);
        weeks.push({
            week_start: shanghaiIso(start),
            week_end: shanghaiIso(end - 1000),
            complete: nowMs >= end,
            new_signups: signups,
            new_paid: [...firstAt.values()].filter(inWeek).length,
            renewals: weekPayments.filter((p) => firstKey.get(p.payer) !== p.key).length,
            order_amount_fen: weekPayments.reduce((sum, p) => sum + p.amountFen, 0),
            refund_amount_fen: null,
            expirations: endDates.filter((ms) => ms >= start && ms < upper).length,
            signups_by_source: bySource,
        });
    }
    return {
        scope: 'site',
        market: 'cn',
        timezone: 'Asia/Shanghai',
        week_definition: WEEK_DEFINITION,
        currency: 'CNY',
        money_unit: '分',
        generated_at: shanghaiIso(nowMs),
        weeks,
        field_notes: notes,
    };
}

// ─── 令牌 ───

type Env = Record<string, string | undefined>;

/** 生效的只读令牌；没配、为空、或与已有口令相同时返回空串（入口关闭）。 */
export function configuredToken(env: Env = process.env): string {
    const token = String(env[READONLY_TOKEN_ENV] ?? '').trim();
    if (!token) return '';
    for (const name of FORBIDDEN_TOKEN_REUSE_ENVS) {
        const other = String(env[name] ?? '').trim();
        if (other && tokenMatches(other, token)) return '';
    }
    return token;
}

/** 先各取 SHA-256 再定长比较：耗时与长度、内容无关。 */
export function tokenMatches(supplied: string, expected: string): boolean {
    if (!supplied || !expected) return false;
    const a = createHash('sha256').update(supplied, 'utf8').digest();
    const b = createHash('sha256').update(expected, 'utf8').digest();
    return timingSafeEqual(a, b);
}

export function bearerToken(header: string | null): string {
    if (!header || header.slice(0, 7).toLowerCase() !== 'bearer ') return '';
    return header.slice(7).trim();
}

export function payerDigest(userId: string): string {
    return createHash('sha256').update(userId, 'utf8').digest('hex');
}
