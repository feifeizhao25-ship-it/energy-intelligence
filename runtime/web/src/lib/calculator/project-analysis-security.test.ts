import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/v2/project/[id]/analyze/route';
import { POST as solar } from '@/app/api/v2/solar/calculate/route';
import { SolarCalculatorV2 } from './solar-v2';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/api/verified-solar', () => ({ verifiedSolar: () => Promise.reject(new Error('SOLAR_DATA_UNAVAILABLE')) }));
jest.mock('@/lib/prisma', () => ({ prisma: { project: { findFirst: jest.fn() }, projectTimeline: { findMany: jest.fn() } } }));
const request = (body: unknown = {}) => new NextRequest('http://localhost/api/test', { method: 'POST', body: JSON.stringify(body) });
const props = { params: Promise.resolve({ id: 'project' }) };
beforeEach(() => {
    jest.resetAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'project' });
});

test.each([GET, POST])('project analysis authenticates and checks ownership before reading history', async handler => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await handler(request(), props)).status).toBe(401);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
    expect((await handler(request(), props)).status).toBe(404);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({ where: { id: 'project', userId: 'owner' }, select: { id: true } });
    expect(prisma.projectTimeline.findMany).not.toHaveBeenCalled();
});
test('history uses persisted records with both owner and project filters', async () => {
    (prisma.projectTimeline.findMany as jest.Mock).mockResolvedValue([{ id: 'event', type: 'DECISION_MADE', title: '历史决策', description: '原始记录', createdAt: new Date(0), tags: [] }]);
    const response = await GET(request(), props);
    expect(response.status).toBe(200);
    expect(prisma.projectTimeline.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'project', userId: 'owner' }, take: 20 }));
    expect(await response.json()).toMatchObject({ timeline: { milestones: [{ id: 'event', summary: '原始记录' }], stats: null }, currentState: null });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
});
test('database failure is not represented as empty successful history', async () => {
    (prisma.projectTimeline.findMany as jest.Mock).mockRejectedValue(new Error('private connection details'));
    const response = await GET(request(), props);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private connection');
});
test('project analysis cannot return simulated evidence or scores', async () => {
    const response = await POST(request({ location: { lat: 30, lng: 120 }, capacity: 100, unitCost: 3, electricityPrice: 0.5 }), props);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false });
});
test('solar API requires login and rejects foreign project references', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    expect((await solar(request())).status).toBe(401);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
    expect((await solar(request({ projectId: 'foreign' }))).status).toBe(404);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', userId: 'owner' }, select: { id: true } });
});
test.each([null, [], { projectId: 1 }, { projectId: '' }])('solar rejects invalid input %p', async body => {
    expect((await solar(request(body))).status).toBe(400);
});
test('solar API clearly reports unavailable data', async () => {
    const response = await solar(request({ location: { lat: 30, lng: 120 }, capacity: 100, unitCost: 3, electricityPrice: 0.5 }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ success: false });
});
test('direct calculator calls cannot generate fixed NASA evidence', async () => {
    await expect(SolarCalculatorV2.calculate({ location: { lat: 39.9, lng: 116.4 }, capacity: 100, unitCost: 3.5, electricityPrice: 0.45 }))
        .rejects.toThrow('SOLAR_DATA_UNAVAILABLE');
});
