import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from '@/app/audit/[snapshotId]/page';
import Library from '@/app/audit/page';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('LOGIN_REQUIRED'); }) }));
jest.mock('@/lib/prisma', () => ({ prisma: { calculationSnapshot: { findFirst: jest.fn(), findMany: jest.fn() } } }));
const params = { params: Promise.resolve({ snapshotId: 'saved' }) };
beforeEach(() => { jest.resetAllMocks(); (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } }); });
test('snapshot page filters by owner and shows saved null financial outcomes honestly', async () => {
    (prisma.calculationSnapshot.findFirst as jest.Mock).mockResolvedValue({ id: 'saved', calcType: 'SOLAR_REVENUE', createdAt: new Date(), outputSnapshot: { irr: null, paybackPeriod: null, npv: -100 }, calculationTrace: {}, dataEvidence: {}, risks: [] });
    const html = renderToStaticMarkup(await Page(params));
    expect(prisma.calculationSnapshot.findFirst).toHaveBeenCalledWith({ where: { id: 'saved', userId: 'owner' } });
    expect(html).toContain('估算期内未回本'); expect(html).toContain('无法确认唯一值'); expect(html).toContain('-100');
    expect(html).not.toContain('NaN');
});
test('missing or inaccessible snapshot never substitutes a sample result', async () => {
    (prisma.calculationSnapshot.findFirst as jest.Mock).mockResolvedValue(null);
    expect(renderToStaticMarkup(await Page(params))).toContain('计算记录不存在或无法访问');
});
test('database failure does not masquerade as no saved history or expose details', async () => {
    (prisma.calculationSnapshot.findFirst as jest.Mock).mockRejectedValue(new Error('private password'));
    const html = renderToStaticMarkup(await Page(params));
    expect(html).toContain('暂时无法读取'); expect(html).not.toContain('password');
});

test('record library reports storage failures separately from an empty history', async () => {
    (prisma.calculationSnapshot.findMany as jest.Mock).mockRejectedValue(new Error('private database'));
    const failed = renderToStaticMarkup(await Library());
    expect(failed).toContain('读取失败不代表记录已丢失');
    expect(failed).not.toContain('暂无已保存');
    (prisma.calculationSnapshot.findMany as jest.Mock).mockResolvedValue([]);
    expect(renderToStaticMarkup(await Library())).toContain('暂无已保存');
    expect(prisma.calculationSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' }, take: 50 }));
});
