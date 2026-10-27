/** 本地 Postgres 上的工单与遥测表。没有隔离库时整组跳过。 */

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('operations and literature tables on local Postgres', () => {
  const userId = `gap-${Date.now()}`;
  const projectId = `${userId}-project`;

  beforeAll(async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    (global as { prisma?: unknown }).prisma = prisma;
    await prisma.user.create({ data: { id: userId, email: `${userId}@test.invalid`, name: '缺口测试' } });
    await prisma.project.create({ data: { id: projectId, userId, name: '遥测项目', type: 'SOLAR' } });
  });

  afterAll(async () => {
    const prisma = (global as { prisma?: { workOrder: { deleteMany: Function }; telemetrySample: { deleteMany: Function }; project: { deleteMany: Function }; user: { deleteMany: Function }; $disconnect: Function } }).prisma;
    if (!prisma) return;
    await prisma.telemetrySample.deleteMany({ where: { projectId } });
    await prisma.workOrder.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('写入工单和一条遥测', async () => {
    const prisma = (global as { prisma: { workOrder: { create: Function; findFirst: Function }; telemetrySample: { create: Function; count: Function } } }).prisma;
    const order = await prisma.workOrder.create({
      data: { projectId, title: '巡检逆变器', type: 'inspection', createdBy: userId, assignee: '值班' },
    });
    expect(order.title).toBe('巡检逆变器');
    await prisma.telemetrySample.create({
      data: { projectId, pointId: 'inv-1', recordedAt: new Date('2026-10-27T00:00:00Z'), powerKw: 12.5, source: 'csv', alarmCode: '' },
    });
    const saved = await prisma.workOrder.findFirst({ where: { id: order.id } });
    const count = await prisma.telemetrySample.count({ where: { projectId } });
    expect(saved.assignee).toBe('值班');
    expect(count).toBe(1);
  });
});
