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
