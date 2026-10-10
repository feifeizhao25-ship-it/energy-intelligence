/**
 * 政策审核员名单：站内没有平台级管理员体系（enterprise.ts 的 ADMIN 是企业组织内角色，团队 admin 只管团队），
 * 所以由运营方在环境变量 POLICY_REVIEWERS 里指定谁能审核——逗号分隔的用户 ID 或登录手机号，例如
 *   POLICY_REVIEWERS=clx123abc,13800000000
 * 未配置时任何人都不是审核员（默认拒绝）。代码里不写死任何人名或手机号。
 */
export function reviewerAllowlist(env: Record<string, string | undefined> = process.env): Set<string> {
    return new Set(String(env.POLICY_REVIEWERS ?? '').split(/[,，\s]+/).map(s => s.trim()).filter(Boolean));
}

export function isPolicyReviewer(user: { id: string; phone?: string | null } | null | undefined, env?: Record<string, string | undefined>): boolean {
    if (!user?.id) return false;
    const list = reviewerAllowlist(env);
    return list.has(user.id) || (!!user.phone && list.has(user.phone));
}

/** 写进 policies.reviewer 的审核人：姓名 + 用户 ID（不写手机号） */
export function reviewerLabel(user: { id: string; name?: string | null }): string {
    const name = String(user.name ?? '').trim();
    return name ? `${name}（用户 ${user.id}）` : `用户 ${user.id}`;
}
