import { GET as legacy } from '@/app/api/audit/[id]/route';
import { GET as current } from '@/app/api/v2/audit/[id]/route';
import { getServerSession } from 'next-auth';
import { getAuditRecord, verifyAuditRecord } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/audit', () => ({ getAuditRecord: jest.fn(), verifyAuditRecord: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { calculationSnapshot: { findFirst: jest.fn() } } }));
const req = new NextRequest('https://example.test/api/audit/record');
const params = { params: Promise.resolve({ id: 'record' }) };
beforeEach(() => {
    jest.resetAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (verifyAuditRecord as jest.Mock).mockResolvedValue({ valid: false, reason: '缺少校验值' });
});
test.each([legacy, current])('anonymous requests are rejected before database reads', async handler => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await handler(req, params);
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(getAuditRecord).not.toHaveBeenCalled();
    expect(prisma.calculationSnapshot.findFirst).not.toHaveBeenCalled();
});
test.each([null, { userId: 'other' }])('legacy missing and foreign records have indistinguishable responses', async record => {
    (getAuditRecord as jest.Mock).mockResolvedValue(record);
    const res = await legacy(req, params);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: '计算记录不存在或无法访问' });
    expect(verifyAuditRecord).not.toHaveBeenCalled();
});
test('owner receives calculation but not IP or client tracking fields', async () => {
    (getAuditRecord as jest.Mock).mockResolvedValue({ userId: 'owner', orgId: 'org-secret', ipAddress: 'private-ip', userAgent: 'private-agent', inputs: { capacity: 100 }, outputs: {}, versionMeta: {}, evidences: [] });
    const res = await legacy(req, params);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const data = await res.json();
    expect(data.record.inputs.capacity).toBe(100);
    for (const key of ['userId','orgId','ipAddress','userAgent']) expect(data.record).not.toHaveProperty(key);
    expect(data.verification.valid).toBe(false);
});
test('V2 read is scoped to session owner and failures do not reveal database errors', async () => {
    (prisma.calculationSnapshot.findFirst as jest.Mock).mockRejectedValue(new Error('private database secret'));
    const res = await current(req, params);
    expect(prisma.calculationSnapshot.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'record', userId: 'owner' } }));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('secret');
});
