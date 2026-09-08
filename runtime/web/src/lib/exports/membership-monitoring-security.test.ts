import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as validate } from '@/app/api/membership/validate-code/route';
import { GET, POST, PUT } from '@/app/api/v2/project/[id]/activate/route';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { discountCode: { findUnique: jest.fn() }, project: { findFirst: jest.fn() } } }));
const coupon = () => ({ code: 'REAL20', discountPercent: 20, applicablePlans: ['PRO'], maxUses: 5, usedCount: 0,
    validFrom: new Date(Date.now() - 1000), validUntil: new Date(Date.now() + 60000), isActive: true });
const request = (body: unknown = { code: 'real20', plan: 'PRO' }) => new NextRequest('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
    jest.resetAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue(coupon());
});
test('anonymous coupon validation does not query the database', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await validate(request())).status).toBe(401);
    expect(prisma.discountCode.findUnique).not.toHaveBeenCalled();
});
test.each([null, {}, { code: 123, plan: 'PRO' }, { code: 'A', plan: 'FREE' }, { code: 'A', plan: 'invented' }])('rejects malformed coupon request %p', async body => {
    expect((await validate(request(body))).status).toBe(400);
    expect(prisma.discountCode.findUnique).not.toHaveBeenCalled();
});
test('uses the database record and marks the result as a preview', async () => {
    const response = await validate(request());
    expect(response.status).toBe(200);
    expect(prisma.discountCode.findUnique).toHaveBeenCalledWith({ where: { code: 'REAL20' } });
    expect((await response.json()).data).toMatchObject({ discountPercent: 20, previewOnly: true });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
});
test.each([
    ['missing', null, 404], ['disabled', { isActive: false }, 404],
    ['future', { validFrom: new Date(Date.now() + 600000) }, 400],
    ['expired', { validUntil: new Date(0) }, 400], ['zero capacity', { maxUses: 0 }, 400],
    ['exhausted', { usedCount: 5 }, 400], ['wrong plan', { applicablePlans: ['TEAM'] }, 400],
    ['invalid discount', { discountPercent: 101 }, 503],
])('rejects %s coupon', async (_name, overrides, status) => {
    (prisma.discountCode.findUnique as jest.Mock).mockResolvedValue(overrides === null ? null : { ...coupon(), ...overrides as object });
    expect((await validate(request())).status).toBe(status);
});
test('database failure cannot produce a sample coupon or leak internals', async () => {
    (prisma.discountCode.findUnique as jest.Mock).mockRejectedValue(new Error('private database details'));
    const response = await validate(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database');
});
test.each([GET, POST, PUT])('monitoring enforces ownership and never fabricates success', async handler => {
    const props = { params: Promise.resolve({ id: 'project' }) };
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await handler(request(), props)).status).toBe(401);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner', plan: 'PRO' } });
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
    expect((await handler(request(), props)).status).toBe(404);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({ where: { id: 'project', userId: 'owner' }, select: { id: true } });
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'project' });
    const response = await handler(request(), props);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false, error: 'MONITORING_UNAVAILABLE' });
});
