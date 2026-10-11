/**
 * Word 测算报告：定价页承诺「PDF 与 Word 导出」，原来没有任何 Word 生成代码。
 * 这里锁定：能生成合法 .docx；数字与 PDF 报告同一来源；AI 生成标识（显式 + 文档属性）按是否含 AI 文字如实写入。
 */
import JSZip from 'jszip';
import { calculationDocxBuffer, AI_LABEL_TEXT } from './calculation-docx';
import { reportConclusion, reportNumber } from './calculation-report';

const data = {
    energy: { year1: 136_900, monthly: [8100, 9000, 11800, 13200, 14500, 13900, 14100, 13600, 11900, 10500, 8600, 7700], lifetime: 3_200_000, equivalentHours: 1369, pr: 0.833 },
    financial: { irr: 8.23, paybackYears: 9.1, lcoe: 0.312, investment: 350_000, cashFlow: Array(25).fill(40_000), revenue: Array(25).fill(43_500) },
    assumptions: { lifetimeYears: 25, discountRate: 0.08, omCostRatio: 0.01, omEscalation: 0.02, firstYearDegradation: 1.5, annualDegradation: 0.45 },
    metadata: { projectName: '南京屋顶光伏', province: '江苏', capacity: 100, pricing: { asOfLabel: '电价数据截至 2025-12', staleNote: '可能已变化，请以最新文件为准', source: '来源待核实' } },
};
const at = new Date('2026-10-08T02:00:00Z');

async function open(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const read = (name: string) => zip.file(name)!.async('string');
    const doc = await read('word/document.xml');
    return { doc, plain: doc.replace(/<[^>]+>/g, ''), core: await read('docProps/core.xml'), custom: await read('docProps/custom.xml'), footer: (await Promise.all(Object.keys(zip.files).filter(n => /word\/footer\d*\.xml/.test(n)).map(read))).join('') };
}

describe('Word 测算报告', () => {
    it('生成合法 docx：标题、指标、月度发电、电价截至、结论与 PDF 同一来源', async () => {
        const buffer = await calculationDocxBuffer(data, 'solar', { generatedAt: at });
        expect(buffer.subarray(0, 2).toString()).toBe('PK');
        const { plain, core, custom, footer } = await open(buffer);
        expect(plain).toContain('南京屋顶光伏');
        expect(plain).toContain(reportNumber(data, at));
        expect(plain).toContain('8.23%');
        expect(plain).toContain('9.1 年');
        expect(plain).toContain('0.312 元/度');
        expect(plain).toContain('14,500'); // 5 月发电量
        expect(plain).toContain('电价数据截至 2025-12，可能已变化，请以最新文件为准（来源待核实）');
        expect(plain).toContain('内部收益率（IRR）');
        expect(plain).toContain('平准化度电成本（LCOE，折现）');
        expect(plain).toContain('100 kWp');
        expect(plain).toContain(reportConclusion(8.23, 9.1, 25));
        // 不含 AI 文字时如实写明，并写进文档属性
        expect(plain).toContain('规则引擎测算，未含 AI 生成文字');
        expect(plain).not.toContain('【AI 辅助生成】');
        expect(core).toContain('规则引擎测算');
        expect(custom).toContain('未含AI生成内容');
        expect(footer).toContain('测算结果仅供参考');
    });

    it('含 AI 分析文字时：正文显式标注【AI 辅助生成】，文档属性写入 AI 生成标识与服务提供者、内容编号', async () => {
        const { plain, core, custom } = await open(await calculationDocxBuffer(data, 'solar', { generatedAt: at, aiAnalysis: '电价下调 5% 时 IRR 约降低 0.9 个百分点。' }));
        expect(plain).toContain(AI_LABEL_TEXT);
        expect(plain).toContain('电价下调 5% 时');
        expect(core).toContain('AI辅助生成');
        expect(custom).toContain('含AI辅助生成内容');
        expect(custom).toContain('新能源智库');
        expect(custom).toContain(reportNumber(data, at));
    });

    it('储能结果（指标在 financial.metrics）也能导出，缺投资额写「未填写」而不兜底', async () => {
        const storage = { financial: { metrics: { irr: 5.2, paybackYears: 8.4, lcos: 0.41 } }, pricing: { asOfLabel: null, source: '用户输入' } };
        const { plain } = await open(await calculationDocxBuffer(storage, 'storage', { generatedAt: at }));
        expect(plain).toContain('5.20%');
        expect(plain).toContain('0.410 元/度');
        expect(plain).toContain('未填写');
        expect(plain).toContain('收益偏低');
        // 风电装机单位是 kW，不是 kWp
        const wind = await open(await calculationDocxBuffer({ ...data, metadata: { ...data.metadata, capacity: 3000 } }, 'wind', { generatedAt: at }));
        expect(wind.plain).toContain('3000 kW；');
        expect(wind.plain).not.toContain('kWp');
    });
});
