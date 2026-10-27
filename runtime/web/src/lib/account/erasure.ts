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

/**
 * 没有 userId 字段、因此不会被 userOwnedModels() 自动列举的模型，注销时各自怎么办。
 * schema 里每个模型都必须要么带 userId，要么在这里登记——erasure.test.ts 逐个核对，
 * 新增模型漏登记就失败：新增表的人必须回答「用户注销时这张表怎么办」。
 *
 *   owner      按 ownerId 找（Team）
 *   viaParent  没有用户列，但有指向用户所拥有模型的外键（要么随父表级联，要么必须在这里先删）
 *   email/phone 按注销前的邮箱 / 手机号找（页面提交的表单、验证码）
 *   retained   财务记录，依法保留（只带用户 ID，用户行已匿名化）
 *   global     与任何用户无关的全局数据（写明理由）
 */
export const NON_USER_MODELS: Record<string, { how: 'owner' | 'viaParent' | 'email' | 'phone' | 'retained' | 'global'; note: string }> = {
  Team: { how: 'owner', note: 'ownerId 唯一；成员还在时拒绝注销，否则删除团队' },
  ProjectComparison: { how: 'viaParent', note: '对 Project 的外键没有级联；快照含项目数据，必须先于 Project 删除' },
  StationRecord: { how: 'viaParent', note: '随 Station 级联' },
  ProjectPaperRecommendation: { how: 'viaParent', note: '随 Project 级联' },
  PaperNote: { how: 'viaParent', note: '随 SavedPaper 级联' },
  DailyAnalysis: { how: 'viaParent', note: '随 Project / ActivatedProject 级联' },
  AssetHealthHistory: { how: 'viaParent', note: '随 Project / ActivatedProject 级联' },
  MaintenancePlan: { how: 'viaParent', note: '随 Project / ActivatedProject 级联' },
  RealTimeData: { how: 'viaParent', note: '随 Project / ActivatedProject 级联' },
  AssetAlert: { how: 'viaParent', note: '随 Project / ActivatedProject 级联' },
  DemoRequest: { how: 'email', note: '官网预约演示表单，含姓名、邮箱、电话；按本人邮箱删除' },
  VerificationCode: { how: 'phone', note: '验证码以手机号为键；按本人手机号删除' },
  ReferralRecord: { how: 'retained', note: '推荐奖励记录（含现金奖励），只带用户 ID；用户行已匿名化' },
  Policy: { how: 'global', note: '政策库，公开数据' },
  DiscountCode: { how: 'global', note: '优惠码定义' },
  FeatureFlag: { how: 'global', note: '功能开关' },
  Achievement: { how: 'global', note: '成就定义' },
  CalcVersionRegistry: { how: 'global', note: '测算版本登记' },
  AssumptionSet: { how: 'global', note: '测算假设集，系统预置' },
  WorkOrder: { how: 'viaParent', note: '随 Project 级联' },
  WorkOrderAttachment: { how: 'viaParent', note: '随 WorkOrder 级联' },
  WorkOrderEvent: { how: 'viaParent', note: '随 WorkOrder 级联' },
  TelemetryCredential: { how: 'viaParent', note: '随 Project 级联' },
  TelemetrySample: { how: 'viaParent', note: '随 Project 级联' },
  AlarmRule: { how: 'viaParent', note: '随 Project 级联' },
  AlarmEvent: { how: 'viaParent', note: '随 Project 级联' },
};
const SECRET_FIELD = /(password|keyHash|token|secret|code)$/i;
// 导出时省略的字段：文献向量是模型内部表示，用户读不了；文本原文（content）仍然导出
const EXPORT_NOISE_FIELD = /^embedding$/;

export interface ModelRef { name: string; delegate: string }

/** 所有带 userId 字段的模型（来自生成的 Prisma DMMF）。 */
export function userOwnedModels(): ModelRef[] {
  return Prisma.dmmf.datamodel.models
    .filter((m) => m.name !== 'User' && m.fields.some((f) => f.name === 'userId' && f.kind === 'scalar'))
    .map((m) => ({ name: m.name, delegate: m.name[0].toLowerCase() + m.name.slice(1) }));
}

function strip(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !SECRET_FIELD.test(k) && !EXPORT_NOISE_FIELD.test(k)));
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
  // 以下委托在旧调用方 / 测试替身里可能缺失，所以都是可选的
  team?: { findUnique(args: unknown): Promise<{ id: string } | null>; delete(args: unknown): Promise<unknown> };
  projectComparison?: { findMany(args: unknown): Promise<Record<string, unknown>[]>; deleteMany(args: unknown): Promise<{ count: number }> };
  demoRequest?: { findMany(args: unknown): Promise<Record<string, unknown>[]>; deleteMany(args: unknown): Promise<{ count: number }> };
};

/** 团队还有其他成员时，所有者不能注销（与分发侠一致）：先转让团队或移除成员。 */
export class TeamHasMembersError extends Error {
  constructor(public readonly members: number) {
    super(`团队里还有 ${members} 位成员，请先转让团队或移除成员，再注销账号`);
    this.name = 'TeamHasMembersError';
  }
}

export async function exportUserData(db: Client, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const model of userOwnedModels()) {
    const delegate = db[model.delegate] as AnyDelegate | undefined;
    if (!delegate) continue;
    const rows = await delegate.findMany({ where: { userId } });
    if (rows.length) tables[model.name] = rows.map(strip);
  }
  // 没有 userId、要顺着关系找的：项目对比快照（含项目数据）、官网预约演示表单里本人邮箱的记录
  if (db.projectComparison) {
    const rows = await db.projectComparison.findMany({ where: { project: { userId } } });
    if (rows.length) tables.ProjectComparison = rows.map(strip);
  }
  if (db.demoRequest && user && typeof user.email === 'string' && user.email) {
    const rows = await db.demoRequest.findMany({ where: { email: user.email } });
    if (rows.length) tables.DemoRequest = rows.map(strip);
  }
  return { exportedAt: new Date().toISOString(), user: user ? strip(user) : null, tables };
}

export class FileCleanupError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('文件存储暂时不可用，账号尚未注销，请稍后重试', options);
    this.name = 'FileCleanupError';
  }
}

/**
 * options.beforeErase：团队等前置检查通过之后、删除任何数据之前执行（用来删对象存储里的文件）。
 * 它抛错则整体中止、什么都不动，账号保留、可稍后重试。
 */
export async function eraseUser(db: Client, userId: string, options: { beforeErase?: () => Promise<void> } = {}) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { deleted: {}, retained: {}, failed: [] as string[] };
  const deleted: Record<string, number> = {};
  const retained: Record<string, number> = {};

  // 我是团队所有者：团队里还有别人就拒绝（什么都不动）；只有我一个人就随后删除团队。
  const team = db.team ? await db.team.findUnique({ where: { ownerId: userId } }) : null;
  if (team) {
    const others = await (db.user as unknown as { count(args: unknown): Promise<number> }).count({
      where: { teamId: team.id, id: { not: userId }, deletedAt: null },
    });
    if (others > 0) throw new TeamHasMembersError(others);
  }

  if (options.beforeErase) {
    try { await options.beforeErase(); } catch (error) { throw new FileCleanupError({ cause: error }); }
  }

  // ProjectComparison 对 Project 的外键没有级联：不先删它，Project 删不掉，
  // 账号永远注销不完（并且快照里是项目数据）。
  if (db.projectComparison) {
    const { count } = await db.projectComparison.deleteMany({ where: { project: { userId } } });
    if (count) deleted.ProjectComparison = count;
  }
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
  // 官网「预约演示」表单里留过本人邮箱的记录（姓名、公司、电话）
  if (db.demoRequest && typeof user.email === 'string' && user.email) {
    const { count } = await db.demoRequest.deleteMany({ where: { email: user.email } });
    if (count) deleted.DemoRequest = count;
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
  // 团队：本人已不在成员里（上面 update 清了 teamId），团队没有别人，删掉。
  if (team && db.team) {
    await db.team.delete({ where: { id: team.id } });
    deleted.Team = 1;
  }
  return { deleted, retained, failed: pending.map((m) => m.name) };
}
