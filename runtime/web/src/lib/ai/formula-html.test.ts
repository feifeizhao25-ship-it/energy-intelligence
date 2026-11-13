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

    it('结果页加载 KaTeX 样式，MathML 不会再画成第二行公式', () => {
        const page = readFileSync(join(__dirname, '../../app/(dashboard)/calculator/result/page.tsx'), 'utf8');
        const html = formulaHtml(reportFormula('solar').latex, true);
        const hasHtml = html.includes('katex-html');
        const hasMathml = html.includes('katex-mathml');
        expect(hasHtml || hasMathml).toBe(true);
        if (hasHtml && hasMathml) {
            expect(page).toContain("katex/dist/katex.min.css");
            // 直接读样式文件。require.resolve 会被测试里的 css 桩拦截，读不到隐藏规则。
            const css = readFileSync(join(__dirname, '../../../node_modules/katex/dist/katex.min.css'), 'utf8');
            expect(css).toMatch(/\.katex-mathml\{[^}]*clip-path:[^}]*overflow:hidden/);
        } else {
            expect(hasHtml && hasMathml).toBe(false);
        }
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