/**
 * 企业预约演示请求 — 字段校验与防重复提交判断（纯函数，便于单测）。
 */

export interface DemoRequestData {
    name: string;
    company: string;
    email: string;
    phone?: string;
    message?: string;
}

export type ValidationResult =
    | { ok: true; data: DemoRequestData }
    | { ok: false; errors: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{5,20}$/;

const LIMITS = {
    name: 50,
    company: 100,
    email: 254,
    phone: 20,
    message: 500,
} as const;

function asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

export function validateDemoRequest(body: unknown): ValidationResult {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, errors: ['请求体必须是 JSON 对象'] };
    }
    const raw = body as Record<string, unknown>;
    const errors: string[] = [];

    const name = asString(raw.name);
    const company = asString(raw.company);
    const email = asString(raw.email).toLowerCase();
    const phone = asString(raw.phone);
    const message = asString(raw.message);

    if (!name) errors.push('姓名不能为空');
    else if (name.length > LIMITS.name) errors.push(`姓名不能超过 ${LIMITS.name} 个字符`);

    if (!company) errors.push('公司名称不能为空');
    else if (company.length > LIMITS.company) errors.push(`公司名称不能超过 ${LIMITS.company} 个字符`);

    if (!email) errors.push('邮箱不能为空');
    else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.push('邮箱格式不正确');

    if (phone && !PHONE_RE.test(phone)) errors.push('电话格式不正确');

    if (message.length > LIMITS.message) errors.push(`需求说明不能超过 ${LIMITS.message} 个字符`);

    if (errors.length > 0) return { ok: false, errors };

    const data: DemoRequestData = { name, company, email };
    if (phone) data.phone = phone;
    if (message) data.message = message;
    return { ok: true, data };
}

/** 防重复提交窗口：同一邮箱在窗口期内已有待处理请求即视为重复。 */
export const DEDUPE_WINDOW_HOURS = 24;

export function isDuplicateRequest(
    existing: { createdAt: Date } | null,
    now: Date = new Date(),
    windowHours: number = DEDUPE_WINDOW_HOURS,
): boolean {
    if (!existing) return false;
    const ageMs = now.getTime() - existing.createdAt.getTime();
    return ageMs >= 0 && ageMs < windowHours * 60 * 60 * 1000;
}
