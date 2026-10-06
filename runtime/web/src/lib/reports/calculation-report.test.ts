import fs from 'fs';
import path from 'path';
import {
    reportConclusion, reportNumber, degradationText, displayOrNotFilled,
    REPORT_DISCLAIMER, PDF_FONT_FILES,
} from './calculation-report';

const REPORT_SRC = path.resolve(__dirname, '../../components/calculator/InvestmentReport.tsx');
const PUBLIC = path.resolve(__dirname, '../../../public');

describe('PDF 测算报告结论', () => {
    it('IRR < 6% 时写「收益偏低，建议复核电价与造价」，不出现任何立项建议', () => {
        const text = reportConclusion(4.2, 14.3);
        expect(text).toContain('收益偏低');
        expect(text).toContain('建议复核电价与造价');
        expect(text).not.toMatch(/立项|财务可行性/);
        expect(text).toContain(REPORT_DISCLAIMER);
    });

    it('IRR 6–8% 低于基准时提示审慎评估', () => {
        const text = reportConclusion(7, 11);
        expect(text).toContain('低于常用的 8% 比较基准');
        expect(text).not.toContain('立项');
    });

    it('IRR 高时也不写「建议尽快推动立项开发」，仍附免责声明', () => {
        const text = reportConclusion(12.5, 6.1);
        expect(text).not.toMatch(/建议尽快推动立项|具有较强的财务可行性/);
        expect(text).toContain('须结合现场勘察');
        expect(text.endsWith('测算结果仅供参考，不构成投资建议。')).toBe(true);
    });

    it('IRR 无解、估算期内未回本时如实写出', () => {
        expect(reportConclusion(null, null)).toContain('无法确认唯一的内部收益率');
        expect(reportConclusion(3, 25, 25)).toContain('25 年估算期内未回本');
    });
});

describe('报告编号可追溯', () => {
    const at = new Date('2026-10-08T01:30:00Z');
    it('有项目/记录 id 时为 CR-<id>-<北京时间日期>', () => {
        expect(reportNumber({ metadata: { projectId: 'proj_123' } }, at)).toBe('CR-proj_123-20261008');
        expect(reportNumber({ metadata: { calculationId: 'calc-9' } }, new Date('2026-10-07T17:00:00Z'))).toBe('CR-calc-9-20261008');
    });
    it('没有 id 时按结果内容生成，同一结果编号相同（不再是随机数）', () => {
        const data = { energy: { year1: 1000 }, financial: { investment: 5, irr: 7 }, metadata: { province: '江苏' } };
        expect(reportNumber(data, at)).toBe(reportNumber(JSON.parse(JSON.stringify(data)), at));
        expect(reportNumber(data, at)).toMatch(/^CR-U[0-9A-F]{8}-20261008$/);
        expect(reportNumber({ ...data, financial: { investment: 6, irr: 7 } }, at)).not.toBe(reportNumber(data, at));
    });
});

describe('报告文字与引擎一致、缺省显式写「未填写」', () => {
    it('衰减描述取自引擎 assumptions', () => {
        expect(degradationText({ firstYearDegradation: 1.5, annualDegradation: 0.45 }))
            .toBe('衰减：首年按模型发电量计；第 2 年起较首年下降 1.5%，此后每年再下降 0.45%');
        expect(degradationText(undefined)).toContain('未返回');
    });
    it('省份缺省为「未填写」', () => {
        expect(displayOrNotFilled(undefined)).toBe('未填写');
        expect(displayOrNotFilled(' ')).toBe('未填写');
        expect(displayOrNotFilled('江苏')).toBe('江苏');
    });

    it('报告组件源码：不再请求 gstatic、不叫「投资建议书」、不兜底苏州/300 万、编号不用随机数、年度收入与现金流取不同字段', () => {
        const src = fs.readFileSync(REPORT_SRC, 'utf8');
        expect(src).not.toMatch(/gstatic|googleapis/);
        expect(src).not.toContain('投资建议书');
        expect(src).not.toContain('建议尽快推动立项');
        expect(src).not.toMatch(/'苏州'|3000000/);
        expect(src).not.toContain('Math.random');
        expect(src).toContain('PDF_FONT_FILES.regular');
        expect(src).toMatch(/revenue\[year - 1\]/);
        expect(src).toMatch(/cashFlow\[year - 1\]/);
        expect(src).toContain('AI 辅助生成');
    });

    it('自托管字体文件存在且带 OFL 授权', () => {
        for (const file of Object.values(PDF_FONT_FILES)) {
            const full = path.join(PUBLIC, file);
            expect(fs.existsSync(full)).toBe(true);
            expect(fs.statSync(full).size).toBeGreaterThan(1_000_000);
        }
        expect(fs.readFileSync(path.join(PUBLIC, 'fonts/noto-sans-sc/OFL.txt'), 'utf8')).toContain('SIL Open Font License');
    });
});
