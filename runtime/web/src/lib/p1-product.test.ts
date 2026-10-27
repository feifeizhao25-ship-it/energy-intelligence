import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseCallouts } from '@/lib/ai/directives';
import { fieldsFor, shownNumbers } from '@/lib/calculator/display-mode';
import { schmidtLcos, scheduleTwoWindows } from '@/lib/calculator/storage';
import { solveIrr } from '@/lib/calculator/project-finance';
import { taxAssumptions } from '@/lib/calculator/project-finance';
import { parseChartSpec, specToTable } from '@/lib/charts/chart-spec';
import { composeHome } from '@/lib/dashboard/composer';
import { PRODUCT_ROLES, ROLE_MODULE_ORDER, defaultReadingMode } from '@/lib/dashboard/personalization';
import { markUnderstood, profileFromUsageMetadata, visibleTags } from '@/lib/dashboard/user-profile';
import roleTemplates from '@/lib/dashboard/role_templates.json';
import { formulaLibrary } from '@/lib/formulas/library';
import { findTerm, glossaryCount, glossaryReviewStatus } from '@/lib/glossary/lookup';
import { publishAllowed } from '@/lib/growth/publish-gate';
import { canExport, inviteMember } from '@/lib/membership/team-admin';
import { paidCheckoutOpen, planAfterTrial, startTrial, trialWatermark } from '@/lib/membership/trial';
import { quoteUpgrade, upgradeDifferenceYuan } from '@/lib/membership/upgrade-proration';
import { gazetteBuffer } from '@/lib/reports/ooxml-zip';
import { renderReportDocx } from '@/lib/reports/render-docx';
import { REPORT_BUILDERS } from '@/lib/reports/report-builders';
import { originLabel } from '@/lib/resource/origin-label';
import { shareCardSvg } from '@/lib/share/card';
import { SEED_PERSONAS } from '@/lib/qa/seed-personas';
import { hasLongEnglishRun } from '@/lib/qa/visible-text';
import { PageShell } from '@/components/layout/PageShell';
import { FreshnessBoard } from '@/components/ops/FreshnessBoard';
import { ChartSpecView } from '@/components/charts/ChartSpecView';

const financeRows = JSON.parse(readFileSync(join(__dirname, '../../../../runtime/backend/data/eval/finance_irr_v1.json'), 'utf8')) as { cashflows: number[]; expected_percent: number | null }[];

describe('国内版 P1 行为', () => {
    it('术语草稿不少于 300 条且待企业微信核对', () => {
        expect(glossaryCount()).toBeGreaterThanOrEqual(300);
        expect(glossaryReviewStatus()).toBe('pending_wecom');
        const term = findTerm('机制电量');
        expect(term?.source_url).toBe('');
        expect(term?.as_of).toBe('2026-10-27');
    });

    it('新手和专业模式展示同一组数字', () => {
        const result = { annualKwh: 1000, lcoe: 0.3, irr: 0.08 };
        expect(shownNumbers('beginner', result)).toEqual(shownNumbers('professional', result));
        expect(fieldsFor('beginner')).toHaveLength(3);
        expect(fieldsFor('professional').length).toBeGreaterThan(3);
    });

    it('图表规格非法时给出固定说明，合法时能转成表', () => {
        expect(parseChartSpec({ type: 'pie' }).ok).toBe(false);
        const spec = parseChartSpec({ type: 'bar', title: '分月', unit: '千瓦时', series: [{ name: '示例', data: [1, 2] }] });
        expect(spec.ok).toBe(true);
        if (spec.ok) expect(specToTable(spec.spec)[1]).toEqual(['1', '1']);
    });

    it('定义框连续编号，未闭合的块留在正文', () => {
        const blocks = parseCallouts(':::定义\n甲\n:::\n:::定理\n乙\n:::\n:::注意\n没有结尾');
        const callouts = blocks.filter((block) => block.type === 'callout');
        expect(callouts.map((block) => block.type === 'callout' && block.number)).toEqual([1, 2]);
        expect(blocks.at(-1)?.type).toBe('markdown');
    });

    it('五个种子用户的首页模块序列两两不同，且每个模块有原因', () => {
        const sequences = SEED_PERSONAS.map((persona) => composeHome(persona).map((item) => item.id).join(','));
        expect(new Set(sequences).size).toBe(SEED_PERSONAS.length);
        for (const persona of SEED_PERSONAS) {
            for (const module of composeHome(persona)) expect(module.reason.length).toBeGreaterThan(0);
            expect(composeHome(persona).length).toBeLessThanOrEqual(8);
        }
    });

    it('七类角色模板与开发者禁用排名模块', () => {
        expect(PRODUCT_ROLES).toHaveLength(7);
        const templates = roleTemplates.roles as Record<string, { modules: string[]; forbidden_modules?: string[] }>;
        for (const role of PRODUCT_ROLES) {
            expect(templates[role].modules.join(',')).toBe(ROLE_MODULE_ORDER[role].join(','));
        }
        expect(templates.developer.forbidden_modules).toEqual(expect.arrayContaining(['ranking', 'recommendation']));
        expect(defaultReadingMode('researcher')).toBe('beginner');
        expect(defaultReadingMode('developer')).toBe('professional');
    });

    it('试用不产生支付，同一手机号不能再开，过期回到免费档', () => {
        const now = new Date('2026-10-27T00:00:00Z');
        const first = startTrial([], '13800138000', now);
        expect(first.ok && first.payment).toBe(null);
        if (!first.ok) throw new Error(first.reason);
        const second = startTrial([first.claim], '13800138000', now);
        expect(second.ok).toBe(false);
        expect(planAfterTrial(first.claim, new Date('2026-11-04T00:00:00Z'), 'PRO')).toBe('FREE');
        expect(trialWatermark(true)).toBe('试用');
        expect(paidCheckoutOpen(false)).toBe(false);
    });

    it('团队第 10 个之后拒绝，只读顾问不能导出', () => {
        let seats = [] as { id: string; role: 'member' }[];
        for (let index = 0; index < 10; index += 1) {
            const next = inviteMember(seats, 10, 'member', `m${index}`);
            expect(next.ok).toBe(true);
            if (next.ok) seats = next.seats;
        }
        expect(inviteMember(seats, 10, 'member', 'm10').ok).toBe(false);
        expect(canExport('readonly_advisor')).toBe(false);
    });

    it('升级补差价未审批前不入账', () => {
        expect(upgradeDifferenceYuan(1980, 5800, 0)).toBe(0);
        expect(upgradeDifferenceYuan(1980, 5800, 1)).toBe(Math.ceil((5800 - 1980) / 365));
        expect(upgradeDifferenceYuan(1980, 5800, 365)).toBe(5800 - 1980);
        expect(upgradeDifferenceYuan(1980, 5800, 366)).toBe(Math.ceil((5800 - 1980) * 366 / 365));
        expect(quoteUpgrade(1980, 5800, 100).applied).toBe(false);
        expect(quoteUpgrade(1980, 5800, 100).approval).toBe('pending_wecom');
    });

    it('旧偏好迁移后角色、省份和开关都还在', () => {
        const profile = profileFromUsageMetadata({ preferences: { role: 'engineer', province: '山东', interest: 'solar', personalized: false, tags: [{ id: 'a', label: '光伏', source: '设置' }] } });
        expect(profile.role).toBe('engineer');
        expect(profile.provinces).toEqual(['山东']);
        expect(profile.topics).toEqual(['solar']);
        expect(profile.personalized).toBe(false);
        expect(visibleTags([{ id: 'b', label: '值得投资', source: '系统' }])).toEqual([]);
        expect(markUnderstood(profile, 't001').understoodTerms).toEqual(['t001']);
    });

    it('分享卡、公文和报告规格带示例与截至', () => {
        const svg = shareCardSvg({ title: '电价摘要', url: 'https://example.cn/policy', asOf: '2026-10-27', sample: true });
        expect(svg).toContain('示例');
        expect(svg).toContain('截至');
        expect(svg).toContain('https://example.cn/policy');
        const docx = gazetteBuffer('资料汇编', [['条款一']]);
        expect(docx.toString('utf8')).toContain('非正式文件');
        expect(docx.toString('utf8')).toContain('黑体');
        const rendered = renderReportDocx(REPORT_BUILDERS[0]());
        expect(rendered.toString('utf8')).toContain('测算报告');
        expect(REPORT_BUILDERS).toHaveLength(6);
    });

    it('财务夹具与储能、税费口径', () => {
        expect(financeRows.length).toBeGreaterThanOrEqual(50);
        for (const row of financeRows) {
            const got = solveIrr(row.cashflows);
            if (row.expected_percent == null) expect(got).toBeNull();
            else expect(Math.abs((got as number) * 100 - row.expected_percent)).toBeLessThanOrEqual(0.1);
        }
        expect(schmidtLcos({ capex: 1000, annualOm: 10, annualChargeCost: 20, annualDischargeKwh: 500, years: 2, discountRate: 0 })).toBeCloseTo((1000 + 30 + 30) / (500 + 500), 5);
        expect(scheduleTwoWindows({ usableKwh: 100, roundTripEfficiency: 0.81, windows: [{ charge: '谷', discharge: '峰' }, { charge: '谷', discharge: '峰' }] }).cycles).toBe(2);
        expect(taxAssumptions().增值税).toBe('未计');
        const wind = readFileSync(join(__dirname, 'calculator/wind.ts'), 'utf8');
        expect(wind).toContain('IEC 61400-12-1');
        expect(wind).toContain('尾流损失单列为假设');
        expect(wind).toContain('可利用率单列为假设');
        expect(wind).toContain('GB/T 18710');
    });

    it('页面骨架、时效看板和图表都有中文说明', () => {
        const html = renderToStaticMarkup(createElement(PageShell, {
            summary: '摘要',
            facts: [{ label: '甲', value: '1' }, { label: '乙', value: '2' }, { label: '丙', value: '3' }],
            aside: createElement(FreshnessBoard, { rows: [{ name: '电价', status: '未达标', asOf: '2026-10-27' }], escalated: ['电价'] }),
            children: createElement(ChartSpecView, { source: { type: 'bar', title: '示例', unit: '千瓦时', series: [{ name: '甲', data: [1, 2] }] } }),
        }));
        expect(html).toContain('测算值不是承诺');
        expect(html).toContain('时效看板');
        expect(html).toContain('示例');
        expect(hasLongEnglishRun('这是中文说明。')).toBe(false);
        expect(hasLongEnglishRun('This page shows five english words together.')).toBe(true);
    });

    it('旧工具定义都能在执行器里找到分支', () => {
        const tools = readFileSync(join(__dirname, 'ai/tools.ts'), 'utf8');
        const executor = readFileSync(join(__dirname, 'ai/tool-executor.ts'), 'utf8');
        const names = [...tools.matchAll(/name: '([^']+)'/g)].map((match) => match[1]);
        expect(names.length).toBeGreaterThanOrEqual(5);
        for (const name of names) expect(executor).toContain(`case '${name}':`);
    });

    it('公式库、资源标注和发布闸门保持待审', () => {
        expect(formulaLibrary().length).toBeGreaterThanOrEqual(4);
        expect(formulaLibrary().every((item) => item.review_status === 'pending_wecom')).toBe(true);
        expect(originLabel('sample')).toBe('示例');
        expect(publishAllowed({ title: '电价说明', sourceUrl: 'https://example.cn/a', asOf: '2026-10-27', claims: ['只复述公告'] }).ok).toBe(false);
    });
});
