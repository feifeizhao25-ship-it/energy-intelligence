/**
 * 反向测试：一条 PENDING（未审核）的度电补贴不能影响 IRR；只有 APPROVED 才计入。
 * prisma.policy.findMany 用内存数组模拟，并按 where.reviewStatus 过滤，与数据库行为一致。
 */
const rows: any[] = [];
jest.mock('@/lib/prisma', () => ({
    prisma: {
        policy: {
            findMany: jest.fn(async ({ where }: any) => rows.filter(r => !where?.reviewStatus || r.reviewStatus === where.reviewStatus)),
            findFirst: jest.fn(async () => null),
            create: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data })),
            update: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data })),
        },
    },
}));
jest.mock('@/lib/api/nasa-power', () => ({
    getSolarResource: jest.fn(async () => ({
        annual: { ghi: 1500, peakSunHours: 1500, optimalTilt: 30, resourceClass: 'III' },
        monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ghi: 125 / new Date(2024, i + 1, 0).getDate(), dni: 0, dhi: 0, temperature: 0 })),
    })),
}));

import { calculateSolar } from '@/lib/calculator/solar';
import { PolicyService } from './policy-service';
import { prisma } from '@/lib/prisma';

const input = {
    lat: 30, lng: 120, capacity: 1000, installationType: 'ground' as const, moduleType: 'standard' as const,
    tilt: 30, azimuth: 180, selfUseRatio: 0, electricityPrice: 0.6, feedInTariff: 0.35, unitCost: 3500, province: '浙江',
};
const subsidy = { id: 's1', region: '浙江', type: 'SUBSIDY_KWH', value: 0.3, unit: '元/kWh', startDate: null, endDate: null };

describe('政策审核门槛', () => {
    beforeEach(() => { rows.length = 0; });

    it('PENDING 的度电补贴不改变 IRR；APPROVED 才计入', async () => {
        const baseline = await calculateSolar(input);
        rows.push({ ...subsidy, reviewStatus: 'PENDING' });
        const pending = await calculateSolar(input);
        expect(pending.financial.irr).toBeCloseTo(baseline.financial.irr, 10);
        expect(pending.financial.year1Revenue).toBeCloseTo(baseline.financial.year1Revenue, 6);

        rows[0].reviewStatus = 'APPROVED';
        const approved = await calculateSolar(input);
        expect(approved.financial.irr).toBeGreaterThan(baseline.financial.irr + 1);
    });

    it('REJECTED 同样不计入', async () => {
        const baseline = await calculateSolar(input);
        rows.push({ ...subsidy, reviewStatus: 'REJECTED' });
        expect((await calculateSolar(input)).financial.irr).toBeCloseTo(baseline.financial.irr, 10);
    });

    it('抓取写库一律为 PENDING 并记录抓取时间，不带审核人', async () => {
        const saved: any = await PolicyService.upsertPolicy({ region: '浙江', type: 'SUBSIDY_KWH', value: 0.1, unit: '元/kWh' });
        expect(saved.reviewStatus).toBe('PENDING');
        expect(saved.fetchedAt).toBeInstanceOf(Date);
        expect(saved.reviewer).toBeNull();
    });

    it('人工审核记录审核人和时间，审核人不能为空', async () => {
        const reviewed: any = await PolicyService.reviewPolicy('p1', 'APPROVED', '张工');
        expect(reviewed).toMatchObject({ reviewStatus: 'APPROVED', reviewer: '张工' });
        expect(reviewed.reviewedAt).toBeInstanceOf(Date);
        await expect(PolicyService.reviewPolicy('p1', 'APPROVED', ' ')).rejects.toThrow('审核人不能为空');
        expect((prisma.policy.update as jest.Mock)).toHaveBeenCalled();
    });
});
