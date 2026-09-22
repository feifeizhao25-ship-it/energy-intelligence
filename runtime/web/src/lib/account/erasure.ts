import { Prisma } from '@prisma/client';

/**
 * 个人信息的导出与注销（个人信息保护法第 45、47 条）。
 *
 * 隐私政策写着「用户可以查询、导出或删除个人信息，也可以注销账户」，设置页写着
 * 「随时可申请注销」——但代码里没有任何导出或注销的接口。
 *
 * 范围：Prisma 模型里所有带 userId 字段的表（按 schema 自动列举，新加的表自动纳入）。
 * - 付款记录（payments）是财务凭证，保留，并在返回里说明；
 * - 审计日志（audit_logs）按安全审计要求保留；
 * - 其余全部删除；用户行本身匿名化（手机号、邮箱、姓名、公司等清空），记录注销时间。
 *   付款记录通过 userId 关联到这条匿名行，所以不物理删除用户行。
 */

export const RETAINED_MODELS = new Set(['Payment', 'AuditLog']);
const SECRET_FIELD = /(password|keyHash|token|secret|code)$/i;

export interface ModelRef { name: string; delegate: string }

/** 所有带 userId 字段的模型（来自生成的 Prisma DMMF）。 */
export function userOwnedModels(): ModelRef[] {
  return Prisma.dmmf.datamodel.models
    .filter((m) => m.name !== 'User' && m.fields.some((f) => f.name === 'userId' && f.kind === 'scalar'))
    .map((m) => ({ name: m.name, delegate: m.name[0].toLowerCase() + m.name.slice(1) }));
}

function strip(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !SECRET_FIELD.test(k)));
}

type AnyDelegate = {
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  deleteMany(args: unknown): Promise<{ count: number }>;
};
type Client = Record<string, unknown> & {
  user: {
    findUnique(args: unknown): Promise<Record<string, unknown> | null>;
    update(args: unknown): Promise<unknown>;
  };
  verificationCode: { deleteMany(args: unknown): Promise<{ count: number }> };
};

export async function exportUserData(db: Client, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const model of userOwnedModels()) {
    const delegate = db[model.delegate] as AnyDelegate | undefined;
    if (!delegate) continue;
    const rows = await delegate.findMany({ where: { userId } });
    if (rows.length) tables[model.name] = rows.map(strip);
  }
  return { exportedAt: new Date().toISOString(), user: user ? strip(user) : null, tables };
}

export async function eraseUser(db: Client, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { deleted: {}, retained: {}, failed: [] as string[] };
  const deleted: Record<string, number> = {};
  const retained: Record<string, number> = {};
  let pending = userOwnedModels();
  for (const model of pending.filter((m) => RETAINED_MODELS.has(m.name))) {
    const rows = await (db[model.delegate] as AnyDelegate).findMany({ where: { userId } });
    if (rows.length) retained[model.name] = rows.length;
  }
  pending = pending.filter((m) => !RETAINED_MODELS.has(m.name));
  // 外键顺序未知：失败的表下一轮重试（子表删完后父表通常就能删了）
  for (let round = 0; round < 4 && pending.length; round++) {
    const failed: ModelRef[] = [];
    for (const model of pending) {
      const delegate = db[model.delegate] as AnyDelegate | undefined;
      if (!delegate) { failed.push(model); continue; }
      try {
        const { count } = await delegate.deleteMany({ where: { userId } });
        if (count) deleted[model.name] = (deleted[model.name] ?? 0) + count;
      } catch {
        failed.push(model);
      }
    }
    if (failed.length === pending.length) { pending = failed; break; }
    pending = failed;
  }
  // Keep the account reachable when cleanup is incomplete so the owner can
  // retry. Do not erase their recovery address or report completed deletion.
  if (pending.length) return { deleted, retained, failed: pending.map((m) => m.name) };
  if (typeof user.phone === 'string' && user.phone) {
    await db.verificationCode.deleteMany({ where: { phone: user.phone } });
  }
  await db.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@invalid.local`,
      name: '已注销用户', phone: null, avatar: null, password: null,
      company: null, jobTitle: null, industry: null, bio: null,
      referralCode: null, referredById: null, teamId: null, teamRole: null,
      plan: 'FREE', planExpireAt: null, deletedAt: new Date(),
    },
  });
  return { deleted, retained, failed: pending.map((m) => m.name) };
}
