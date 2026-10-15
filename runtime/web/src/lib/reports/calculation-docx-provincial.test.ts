import JSZip from 'jszip';
import { calculationDocxBuffer } from './calculation-docx';

const data = {
    energy: { year1: 100_000, monthly: Array(12).fill(8333), lifetime: 2_400_000, equivalentHours: 1000, pr: 0.8 },
    financial: { irr: 8, paybackYears: 9, lcoe: 0.3, investment: 300_000, cashFlow: Array(25).fill(40_000), revenue: Array(25).fill(43_000) },
    assumptions: { lifetimeYears: 25, discountRate: 0.08, omCostRatio: 0.01, omEscalation: 0.02, firstYearDegradation: 1.5, annualDegradation: 0.45 },
    metadata: { projectName: '昆明屋顶光伏', province: '云南省', capacity: 100 },
};

async function plain(buf: Buffer) {
    const zip = await JSZip.loadAsync(buf);
    return (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
}

describe('Word 报告：省级排放因子口径与不确定性小节（审计 8-2 / 3-2）', () => {
    it('云南项目按 0.1333 计算并写明省级口径', async () => {
        const t = await plain(await calculationDocxBuffer(data, 'solar', { generatedAt: new Date('2026-10-15T02:00:00Z') }));
        expect(t).toContain('年减排二氧化碳约 13.3 吨'); // 100,000 kWh × 0.1333 / 1000
        expect(t).toContain('云南省级电力平均二氧化碳排放因子 0.1333 kg/kWh');
        expect(t).not.toContain('全国电力平均排放因子 0.5306');
    });
    it('自动生成“不确定性”小节', async () => {
        const t = await plain(await calculationDocxBuffer(data, 'solar', { generatedAt: new Date('2026-10-15T02:00:00Z') }));
        expect(t).toContain('不确定性');
        expect(t).toContain('首年发电量：约 9.4–10.6 万 kWh（中值 10.0 万）');
        expect(t).toContain('不构成收益承诺');
    });
});
