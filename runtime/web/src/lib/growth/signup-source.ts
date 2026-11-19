/**
 * 国内版注册来源题「从哪知道我们」。
 *
 * - 可跳过的单选，选项固定九个；只存枚举代码，没有自由文本，不认识的值一律丢掉。
 * - 开关 ENERGY_CN_SIGNUP_SOURCE_ENABLED，默认关闭；只在国内版（APP_EDITION=cn）生效。
 * - 存在 signup_source_events 表里，只有代码、时间和用于注销删除的用户 ID；
 *   对外只输出 代码 → 次数 的汇总，从不和手机号、姓名等身份信息一起输出。
 */

export const SIGNUP_SOURCE_FLAG = 'ENERGY_CN_SIGNUP_SOURCE_ENABLED';

export const SIGNUP_SOURCE_QUESTION = '从哪知道我们';

export const SIGNUP_SOURCES = [
    { code: 'xiaohongshu', label: '小红书' },
    { code: 'douyin', label: '抖音' },
    { code: 'wechat_channels', label: '视频号' },
    { code: 'wechat_oa', label: '公众号' },
    { code: 'zhihu', label: '知乎' },
    { code: 'bilibili', label: '哔哩哔哩' },
    { code: 'search', label: '搜索' },
    { code: 'friend', label: '朋友推荐' },
    { code: 'other', label: '其他' },
] as const;

export type SignupSourceCode = (typeof SIGNUP_SOURCES)[number]['code'];

const CODES = new Set<string>(SIGNUP_SOURCES.map((s) => s.code));
const TRUE = new Set(['1', 'true', 'yes', 'on']);

type Env = Record<string, string | undefined>;

function cnEdition(env: Env): boolean {
    return (env.NEXT_PUBLIC_APP_EDITION || env.APP_EDITION || '').toLowerCase() === 'cn';
}

/** 开关打开且是国内版才出题、才记录。 */
export function signupSourceEnabled(env: Env = process.env): boolean {
    return cnEdition(env) && TRUE.has(String(env[SIGNUP_SOURCE_FLAG] ?? '').trim().toLowerCase());
}

/** 只认九个代码（大小写、空格、中文文字都不算）；其余返回 null。 */
export function normalizeSignupSource(raw: unknown): SignupSourceCode | null {
    if (typeof raw !== 'string' || !CODES.has(raw)) return null;
    return raw as SignupSourceCode;
}

export function publicSignupSourceOptions(env: Env = process.env) {
    if (!signupSourceEnabled(env)) {
        return { enabled: false, question: SIGNUP_SOURCE_QUESTION, options: [] as { code: string; label: string }[], skippable: true };
    }
    return {
        enabled: true,
        question: SIGNUP_SOURCE_QUESTION,
        options: SIGNUP_SOURCES.map((s) => ({ code: s.code, label: s.label })),
        skippable: true,
    };
}

/** 汇总：只输出 代码 → 次数，按固定顺序；没有任何身份字段。 */
export function countBySource(rows: Iterable<{ source?: unknown }>): Partial<Record<SignupSourceCode, number>> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const code = normalizeSignupSource(row?.source);
        if (code) counts.set(code, (counts.get(code) || 0) + 1);
    }
    const out: Partial<Record<SignupSourceCode, number>> = {};
    for (const { code } of SIGNUP_SOURCES) {
        const n = counts.get(code);
        if (n) out[code] = n;
    }
    return out;
}

type SignupSourceDb = {
    signupSourceEvent: { createMany(args: { data: { userId: string; source: string }[]; skipDuplicates?: boolean }): Promise<unknown> };
};

/**
 * 新用户完成首次引导（即注册完成）时记一次来源。开关关、不是国内版、没答或不合法都不写。
 * 每个用户最多一条（userId 唯一，重复提交被忽略）。写失败不影响引导。
 */
export async function recordSignupSource(db: SignupSourceDb, userId: string, raw: unknown, env: Env = process.env): Promise<boolean> {
    const source = normalizeSignupSource(raw);
    if (!source || !userId || !signupSourceEnabled(env)) return false;
    try {
        await db.signupSourceEvent.createMany({ data: [{ userId, source }], skipDuplicates: true });
        return true;
    } catch {
        return false;
    }
}
