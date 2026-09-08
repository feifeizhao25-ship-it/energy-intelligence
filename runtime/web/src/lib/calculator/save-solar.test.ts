import { prisma } from '@/lib/prisma';
import { saveSolar } from './save-solar';
import { POST } from '@/app/api/v2/solar/calculate/route';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';
import { SolarCalculatorV2 } from './solar-v2';
import { POST as analyze } from '@/app/api/v2/project/[id]/analyze/route';

jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn(), project: { findFirst: jest.fn() } } }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('./solar-v2', () => ({ SolarCalculatorV2: { calculate: jest.fn() } }));
const tx = {
    $queryRaw: jest.fn(), user: { findUnique: jest.fn() }, quotaUsage: { findUnique: jest.fn(), upsert: jest.fn() },
    calculationSnapshot: { create: jest.fn() }, projectTimeline: { create: jest.fn() },
};
const result = { input: {}, result: { npv: 1 }, assumptions: {}, auditMeta: { version: '3', assumptionVersion: 'test' },
    evidence: { conclusionId: 'evidence', dataProvenance: { solarResource: { metadata: { responseSha256: 'hash' } } } }, limitations: [] } as any;
beforeEach(() => {
    jest.resetAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
    tx.$queryRaw.mockResolvedValue([{ id: 'project' }]);
    tx.user.findUnique.mockResolvedValue({ plan: 'FREE', planExpireAt: null });
    tx.quotaUsage.findUnique.mockResolvedValue({ count: 0 });
    tx.calculationSnapshot.create.mockResolvedValue({ id: 'saved' });
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (SolarCalculatorV2.calculate as jest.Mock).mockResolvedValue(result);
});
test('success writes snapshot, timeline and usage in the same transaction', async () => {
    expect(await saveSolar('owner', 'project', result)).toBe('saved');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.calculationSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'owner', projectId: 'project' }) }));
    expect(tx.projectTimeline.create).toHaveBeenCalled();
    expect(tx.quotaUsage.upsert).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
});
test('expired paid plan cannot bypass free quota', async () => {
    tx.user.findUnique.mockResolvedValue({ plan: 'PRO', planExpireAt: new Date(0) });
    tx.quotaUsage.findUnique.mockResolvedValue({ count: 2 });
    await expect(saveSolar('owner', null, result)).rejects.toMatchObject({ status: 429 });
    expect(tx.calculationSnapshot.create).not.toHaveBeenCalled();
});
test('current paid plan keeps its existing unlimited calculation entitlement', async () => {
    tx.user.findUnique.mockResolvedValue({ plan: 'PRO', planExpireAt: new Date(Date.now() + 60000) });
    tx.quotaUsage.findUnique.mockResolvedValue({ count: 999 });
    expect(await saveSolar('owner', null, result)).toBe('saved');
});
test('ownership is rechecked inside the transaction', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ id: 'owner' }]).mockResolvedValueOnce([]);
    await expect(saveSolar('owner', 'foreign', result)).rejects.toMatchObject({ status: 404 });
    expect(tx.calculationSnapshot.create).not.toHaveBeenCalled();
});
test('failed timeline propagates and does not proceed to quota increment', async () => {
    tx.projectTimeline.create.mockRejectedValue(new Error('write failed'));
    await expect(saveSolar('owner', 'project', result)).rejects.toThrow('write failed');
    expect(tx.quotaUsage.upsert).not.toHaveBeenCalled();
});
test('route only returns persisted true after the database transaction succeeds', async () => {
    const req = () => new NextRequest('http://localhost/api/v2/solar/calculate', { method: 'POST', body: '{}' });
    const good = await POST(req());
    expect(good.status).toBe(200);
    expect(await good.json()).toMatchObject({ data: { snapshotId: 'saved' }, meta: { persisted: true } });
    tx.calculationSnapshot.create.mockRejectedValue(new Error('private DB details'));
    const bad = await POST(req());
    expect(bad.status).toBe(503);
    expect(await bad.text()).not.toContain('private DB details');
});
test('project route overrides a forged body project ID and uses the same saved calculation', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'owned' });
    const response = await analyze(new NextRequest('http://localhost/api/v2/project/owned/analyze', {
        method: 'POST', body: JSON.stringify({ projectId: 'foreign' }),
    }), { params: Promise.resolve({ id: 'owned' }) });
    expect(response.status).toBe(200);
    expect(tx.calculationSnapshot.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: 'owned', userId: 'owner' }) }));
    expect((await response.json()).data.snapshotId).toBe('saved');
});
test('project report request is rejected before calculation or database writes', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'owned' });
    const response = await analyze(new NextRequest('http://localhost/api/v2/project/owned/analyze', {
        method: 'POST', body: JSON.stringify({ generateReport: true }),
    }), { params: Promise.resolve({ id: 'owned' }) });
    expect(response.status).toBe(422);
    expect(SolarCalculatorV2.calculate).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
});
