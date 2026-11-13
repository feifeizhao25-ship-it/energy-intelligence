import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formulaHtml, reportFormula } from '@/lib/ai/formula-html';
import { calculationDocxBuffer } from '@/lib/reports/calculation-docx';
import JSZip from 'jszip';

describe('国内回答和报告里的公式', () => {
    it('回答渲染器首屏就接上 KaTeX，公式字符串能画出 katex', () => {
        const src = readFileSync(join(__dirname, '../../components/ai/AiMarkdown.tsx'), 'utf8');
        expect(src).toContain('rehypeKatex');
        expect(src).toContain('rehypePlugins={[[rehypeKatex');
        expect(src).not.toContain('setRehypeKatex');
        expect(src).not.toContain('rehype-raw');
        const html = formulaHtml('E = H \\times P \\times K', false);
        expect(html).toContain('katex');
        expect(html).toContain('E');
    });

    it('测算页公式是 KaTeX，储能不写成度电成本', () => {
        const solar = formulaHtml(reportFormula('solar').latex, true);
        expect(solar).toContain('katex');
        expect(reportFormula('solar').name).toBe('平准化度电成本');
        expect(reportFormula('storage').name).toBe('平准化储能成本');
        expect(reportFormula('storage').name).not.toContain('平准化度电成本（LCOE）');
    });

    it('Word 测算报告有 1、2、3 级标题且不跳级', async () => {
        const buffer = await calculationDocxBuffer({
            energy: { year1: 1, monthly: [1], lifetime: 1, equivalentHours: 1, pr: 0.8 },
            financial: { irr: 1, paybackYears: 2, lcoe: 0.3, investment: 1, cashFlow: [1], revenue: [1] },
            assumptions: { lifetimeYears: 25, discountRate: 0.08 },
            metadata: { projectName: '公式测试', province: '江苏', capacity: 1 },
        }, 'solar', { generatedAt: new Date('2026-11-13T00:00:00Z') });
        const zip = await JSZip.loadAsync(buffer);
        const xml = await zip.file('word/document.xml')!.async('string');
        const levels = [...xml.matchAll(/w:val="Heading([1-3])"/g)].map((match) => Number(match[1]));
        expect(levels).toEqual(expect.arrayContaining([1, 2, 3]));
        let previous = 0;
        for (const level of levels) {
            expect(level).toBeLessThanOrEqual(previous + 1);
            previous = level;
        }
        expect(xml).toContain('计算公式');
    });
});