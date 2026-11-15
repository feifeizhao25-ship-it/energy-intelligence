import { PRODUCT_ROLES, ROLES, type ProductRole, type Role } from './personalization';

export type { ProductRole, Role };

const KNOWN = new Set<string>([...ROLES, ...PRODUCT_ROLES]);

export function isKnownRole(value: unknown): value is Role {
    return typeof value === 'string' && KNOWN.has(value);
}

export function isProductRole(value: unknown): value is ProductRole {
    return typeof value === 'string' && (PRODUCT_ROLES as readonly string[]).includes(value);
}

/** 从偏好记录里取出用户保存的角色原文，包括不在枚举里的称呼。 */
export function rawSavedRole(metadata: unknown): string | null {
    if (!metadata || typeof metadata !== 'object') return null;
    const root = metadata as Record<string, unknown>;
    const prefs = root.preferences && typeof root.preferences === 'object' ? root.preferences as Record<string, unknown> : {};
    const profile = root.profile && typeof root.profile === 'object' ? root.profile as Record<string, unknown> : {};
    const raw = prefs.role ?? profile.role;
    return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, 40) : null;
}

/** 地址栏里的已知角色优先，否则用已保存的原文。没有保存时不假装是工商业业主。 */
export function displayedRole(urlRole: unknown, savedRole: unknown): string | null {
    if (isKnownRole(urlRole)) return urlRole;
    if (typeof savedRole === 'string' && savedRole.trim()) return savedRole.trim();
    return null;
}

/** 下拉列出全部可保存角色，避免已保存的值不在选项里时浏览器退回第一项。 */
export const SELECTABLE_ROLES: Role[] = [
    ...PRODUCT_ROLES,
    ...ROLES.filter((role) => !(PRODUCT_ROLES as readonly string[]).includes(role)),
];

/** 首页模板只有现行 7 类。旧标识映射到最接近的模板，下拉仍显示原来的称呼。 */
export function landingTemplateRole(role: Role | null): ProductRole | null {
    if (!role) return null;
    if (isProductRole(role)) return role;
    if (role === 'investor') return 'developer';
    if (role === 'owner') return 'om';
    if (role === 'engineer') return 'epc';
    return null;
}
