/**
 * 导出核验：Word 只对套餐里含 Word 的档位开放，且先核验格式再扣额度（不含 Word 的用户不会被白扣一次）。
 */
const session = { user: { id: 'u1' } };
let user: { plan: string; planExpireAt: Date | null } = { plan: 'FREE', planExpireAt: null };
const consumeQuota = jest.fn(async () => ({ success: true, usage: { used: 1, limit: 20, exceeded: false } }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => session) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/audit/quota', () => ({ consumeQuota: (...a: unknown[]) => (consumeQuota as any)(...a) }));
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: jest.fn(async () => user) } } }));

import { POST } from './route';
import { EXPORT_FORMATS } from '@/lib/membership/plans';
import registry from '@/lib/entitlements/entitlements.json';

const reserve = (format?: string) => POST(new Request('http://x/api/exports/reserve', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: format ? JSON.stringify({ format }) : undefined,
}));

describe('导出核验', () => {
    beforeEach(() => consumeQuota.mockClear());

    it('免费版导出 Word：403 中文提示，不扣额度', async () => {
        user = { plan: 'FREE', planExpireAt: null };
        const res = await reserve('docx');
        expect(res.status).toBe(403);
        expect((await res.json()).message).toContain('当前套餐不含 Word 导出');
        expect(consumeQuota).not.toHaveBeenCalled();
    });

    it('专业版（未过期）可导出 Word；已过期按免费版处理', async () => {
        user = { plan: 'PRO', planExpireAt: new Date(Date.now() + 86400e3) };
        expect((await reserve('docx')).status).toBe(200);
        user = { plan: 'PRO', planExpireAt: new Date(Date.now() - 1000) };
        expect((await reserve('docx')).status).toBe(403);
    });

    it('PDF 与旧调用（无请求体）照旧只核验额度', async () => {
        user = { plan: 'FREE', planExpireAt: null };
        expect((await reserve('pdf')).status).toBe(200);
        expect((await reserve()).status).toBe(200);
        expect(consumeQuota).toHaveBeenCalledTimes(2);
    });

    it('定价页权益与实际一致：含 docx 的档位才开放 Word；没有实现的 Excel 不再承诺', () => {
        const tiers = (registry as any).tiers as Record<string, { export: { formats: string[] }; features_zh: string[] }>;
        for (const [plan, formats] of Object.entries(EXPORT_FORMATS)) {
            const tier = tiers[plan.toLowerCase()];
            expect(tier.export.formats.includes('docx')).toBe((formats as readonly string[]).includes('Word'));
            expect(tier.export.formats.includes('xlsx')).toBe((formats as readonly string[]).includes('Excel'));
            expect(tier.export.formats.includes('pptx')).toBe((formats as readonly string[]).includes('PPT'));
        }
    });
});

test.each(['{','null','[]','{"format":"exe"}','{"format":null}','{"format":123}'])('invalid reservation never consumes quota: %s',async body=>{
    consumeQuota.mockClear();
    const result=await POST(new Request('http://x/api/exports/reserve',{method:'POST',body}));
    expect(result.status).toBe(400);expect((await result.json()).message).toMatch(/格式|请求/);expect(consumeQuota).not.toHaveBeenCalled();
});
