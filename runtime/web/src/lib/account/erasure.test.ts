import { eraseUser, exportUserData, userOwnedModels, RETAINED_MODELS } from './erasure';

function fakeDb() {
  const tables: Record<string, { userId: string; [k: string]: unknown }[]> = {};
  const models = userOwnedModels();
  for (const m of models) tables[m.delegate] = [{ userId: 'u1', id: `${m.name}-1`, keyHash: 'h' }, { userId: 'u2', id: `${m.name}-2` }];
  const db: Record<string, unknown> = {};
  for (const m of models) {
    db[m.delegate] = {
      findMany: async ({ where }: { where: { userId: string } }) => tables[m.delegate].filter((r) => r.userId === where.userId),
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        const before = tables[m.delegate].length;
        tables[m.delegate] = tables[m.delegate].filter((r) => r.userId !== where.userId);
        return { count: before - tables[m.delegate].length };
      },
    };
  }
  let user: Record<string, unknown> | null = { id: 'u1', phone: '13800000000', email: 'a@b', name: '张三', password: 'x' };
  const codes = [{ phone: '13800000000' }, { phone: '13900000000' }];
  db.user = {
    findUnique: async () => user,
    update: async ({ data }: { data: Record<string, unknown> }) => { user = { ...user, ...data }; return user; },
  };
  db.verificationCode = { deleteMany: async ({ where }: { where: { phone: string } }) => ({ count: codes.filter((c) => c.phone === where.phone).length }) };
  return { db, tables, getUser: () => user };
}

describe('个人数据导出与注销', () => {
  it('按 schema 自动列举所有带 userId 的表（项目、测算、电站、对话等都在内）', () => {
    const names = userOwnedModels().map((m) => m.name);
    for (const n of ['Project', 'Calculation', 'Station', 'Conversation', 'SavedPaper', 'Payment', 'ApiKey']) expect(names).toContain(n);
  });

  it('导出只含本人数据，且不含密钥类字段', async () => {
    const { db } = fakeDb();
    const out = await exportUserData(db as never, 'u1');
    expect(JSON.stringify(out)).not.toMatch(/u2|keyHash|password/);
    expect(out.tables.Project).toHaveLength(1);
  });

  it('导出不含文献向量（几千维浮点数组，用户读不了，只会把导出文件撑大）', async () => {
    const { db, tables } = fakeDb();
    tables.documentChunk[0].embedding = [0.1, 0.2, 0.3];
    tables.documentChunk[0].content = '光伏';
    const out = await exportUserData(db as never, 'u1');
    expect(out.tables.DocumentChunk).toHaveLength(1);
    expect(out.tables.DocumentChunk[0]).toHaveProperty('content', '光伏');
    expect(out.tables.DocumentChunk[0]).not.toHaveProperty('embedding');
  });

  it('注销删除本人数据、保留付款与审计记录、账号匿名化', async () => {
    const { db, tables, getUser } = fakeDb();
    const result = await eraseUser(db as never, 'u1');
    expect(result.failed).toEqual([]);
    for (const m of userOwnedModels()) {
      const mine = tables[m.delegate].filter((r) => r.userId === 'u1').length;
      expect([m.name, mine]).toEqual([m.name, RETAINED_MODELS.has(m.name) ? 1 : 0]);
      expect(tables[m.delegate].some((r) => r.userId === 'u2')).toBe(true);
    }
    expect(result.retained).toMatchObject({ Payment: 1 });
    expect(getUser()).toMatchObject({ phone: null, name: '已注销用户', password: null });
    expect(getUser()!.deletedAt).toBeInstanceOf(Date);
  });
});


it('清理失败时保留账号和手机号，允许本人重试', async () => {
  const { db, getUser } = fakeDb();
  db.project = { findMany: async () => [], deleteMany: async () => { throw new Error('database unavailable'); } };
  const result = await eraseUser(db as never, 'u1');
  expect(result.failed).toContain('Project');
  expect(getUser()!.phone).toBe('13800000000');
  expect(getUser()!.deletedAt).toBeUndefined();
});

// ─── 2026-09-29：没有 userId 的模型 ───

import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { NON_USER_MODELS, TeamHasMembersError } from './erasure';

describe('注销登记门禁：schema 里每个模型都要回答「用户注销时怎么办」', () => {
  const models = Prisma.dmmf.datamodel.models;

  it('每个模型要么带 userId（自动列举），要么在 NON_USER_MODELS 登记；登记里没有已不存在的模型', () => {
    const owned = new Set(userOwnedModels().map((m) => m.name));
    const unregistered = models.map((m) => m.name).filter((n) => n !== 'User' && !owned.has(n) && !(n in NON_USER_MODELS));
    expect(unregistered).toEqual([]);
    const names = new Set(models.map((m) => m.name));
    expect(Object.keys(NON_USER_MODELS).filter((n) => !names.has(n))).toEqual([]);
    // 登记了的就不应该同时带 userId（否则会被删两遍、说法互相矛盾）
    expect(Object.keys(NON_USER_MODELS).filter((n) => owned.has(n))).toEqual([]);
  });

  it('凡是没有 userId、又对「用户所拥有的模型」有外键的：必须随父表级联，否则父表删不掉——要么显式处理', () => {
    const owned = new Set(userOwnedModels().map((m) => m.name));
    const bad: string[] = [];
    for (const m of models) {
      if (owned.has(m.name) || m.name === 'User') continue;
      for (const f of m.fields) {
        if (f.kind !== 'object' || !f.relationFromFields?.length) continue;
        const parentOwned = owned.has(f.type) || f.type === 'User';
        const cascades = (f as unknown as { relationOnDelete?: string }).relationOnDelete === 'Cascade';
        if (parentOwned && !cascades && NON_USER_MODELS[m.name]?.how === undefined) bad.push(`${m.name}.${f.name}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ProjectComparison 对 Project 没有级联，所以必须在登记里写明是先删的', () => {
    const cmp = models.find((m) => m.name === 'ProjectComparison')!;
    const rel = cmp.fields.find((f) => f.name === 'project')!;
    // 先证明 dmmf 里真的带着 onDelete 信息（否则下面的「不是 Cascade」会空转）
    const station = models.find((m) => m.name === 'StationRecord')!.fields.find((f) => f.name === 'station')!;
    expect((station as unknown as { relationOnDelete?: string }).relationOnDelete).toBe('Cascade');
    expect((rel as unknown as { relationOnDelete?: string }).relationOnDelete).not.toBe('Cascade');
    expect(NON_USER_MODELS.ProjectComparison.how).toBe('viaParent');
    expect(NON_USER_MODELS.ProjectComparison.note).toMatch(/先于 Project/);
  });

  it('对 User 的匿名化而不是删除：Payment 通过 userId 关联到这一行', () => {
    const src = fs.readFileSync(path.join(__dirname, 'erasure.ts'), 'utf8');
    expect(src).not.toMatch(/user\.delete\(/);
  });
});

describe('顺着关系找的数据', () => {
  function richDb(opts: { otherTeamMembers?: number } = {}) {
    const f = fakeDb();
    const log: string[] = [];
    const db = f.db as Record<string, any>;
    db.user.count = async () => opts.otherTeamMembers ?? 0;
    db.team = {
      findUnique: async () => ({ id: 'team1' }),
      delete: async () => { log.push('team.delete'); },
    };
    db.projectComparison = {
      findMany: async () => [{ id: 'pc1', leftSnapshot: { secret: 'x' } }],
      deleteMany: async () => { log.push('projectComparison.deleteMany'); return { count: 2 }; },
    };
    // 顺序记录：ProjectComparison 必须先于 Project 删除
    const originalProject = db.project;
    db.project = { ...originalProject, deleteMany: async (a: any) => { log.push('project.deleteMany'); return originalProject.deleteMany(a); } };
    db.demoRequest = {
      findMany: async () => [{ id: 'd1', email: 'a@b', name: '张三' }],
      deleteMany: async ({ where }: any) => { log.push(`demoRequest.deleteMany:${where.email}`); return { count: 1 }; },
    };
    return { ...f, log };
  }

  it('项目对比快照先于项目删除（否则外键让项目删不掉，账号永远注销不完）', async () => {
    const { db, log } = richDb();
    const result = await eraseUser(db as never, 'u1');
    expect(result.failed).toEqual([]);
    expect(log.indexOf('projectComparison.deleteMany')).toBeGreaterThanOrEqual(0);
    expect(log.indexOf('projectComparison.deleteMany')).toBeLessThan(log.indexOf('project.deleteMany'));
    expect(result.deleted.ProjectComparison).toBe(2);
  });

  it('官网预约演示表单里本人邮箱的记录被删除（且在邮箱被匿名化之前）', async () => {
    const { db, log, getUser } = richDb();
    await eraseUser(db as never, 'u1');
    expect(log).toContain('demoRequest.deleteMany:a@b');
    expect(getUser()!.email).toMatch(/^deleted-u1@/);
  });

  it('团队所有者、团队里没有别人：删除团队', async () => {
    const { db, log } = richDb({ otherTeamMembers: 0 });
    const result = await eraseUser(db as never, 'u1');
    expect(log).toContain('team.delete');
    expect(result.deleted.Team).toBe(1);
  });

  it('团队所有者、团队里还有别人：拒绝，什么都没动', async () => {
    const { db, log, tables, getUser } = richDb({ otherTeamMembers: 2 });
    await expect(eraseUser(db as never, 'u1')).rejects.toBeInstanceOf(TeamHasMembersError);
    expect(log).toEqual([]);
    expect(tables.project.some((r) => r.userId === 'u1')).toBe(true);
    expect(getUser()!.name).toBe('张三');
  });

  it('导出含项目对比快照与本人邮箱的演示预约，仍不含密钥', async () => {
    const { db } = richDb();
    const out: any = await exportUserData(db as never, 'u1');
    expect(out.tables.ProjectComparison).toHaveLength(1);
    expect(out.tables.DemoRequest).toHaveLength(1);
    expect(JSON.stringify(out)).not.toMatch(/keyHash|"password"/);
  });
});
