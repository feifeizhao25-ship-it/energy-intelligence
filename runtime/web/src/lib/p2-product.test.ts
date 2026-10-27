import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFlow } from '@/components/ai/MermaidBlock';
import { DataTable } from '@/components/ui/DataTable';
import { requireAlt } from '@/components/media/MediaFrame';
import { emptyNextStep } from '@/components/ui/EmptyState';
import { allowPush, salutation } from '@/lib/dashboard/push-cadence';
import { canonicalPlanId, storedPlanId } from '@/lib/membership/plan-alias';
import { chartMotionMs, chartPalette } from '@/lib/charts/motion';
import { spaceCjkLatin } from '@/lib/typography/spacing';
import { gazetteCoverOk } from '@/lib/reports/gazette-check';

const flows = [
    'flowchart TD\n  甲[准备材料] --> 乙[核对原文]',
    'flowchart TD\n  甲[备案] --> 乙[并网]',
    'flowchart LR\n  甲[收文] --> 乙[分办]',
    'graph TD\n  甲[测算] --> 乙[注明来源]',
    'flowchart TD\n  甲[关注省份] --> 乙[查看电价]',
    'flowchart TD\n  甲[上传] --> 乙[待审批]',
    'flowchart TD\n  甲[周报] --> 乙[窗口内发送]',
    'flowchart TD\n  甲[角色] --> 乙[首页模块]',
    'flowchart TD\n  甲[旧版] --> 乙[现行版本]',
    'flowchart TD\n  甲[示例] --> 乙[标注示例]',
];

describe('国内版 P2', () => {
    it('十个流程图在严格模式下能读出节点，脚本被拒绝', () => {
        expect(flows).toHaveLength(10);
        for (const source of flows) {
            const figure = readFlow(source);
            expect(figure.ok).toBe(true);
            expect(figure.securityLevel).toBe('strict');
            expect(figure.nodes.length).toBeGreaterThan(0);
        }
        expect(readFlow('flowchart TD\n  甲[准备] --> 乙[<script>alert(1)</script>]').ok).toBe(false);
    });

    it('表格默认只显示六行', () => {
        const rows = Array.from({ length: 8 }, (_, index) => ({ name: `第${index + 1}行` }));
        const html = renderToStaticMarkup(createElement(DataTable, {
            columns: [{ key: 'name', label: '名称' }],
            rows,
        }));
        expect(html.match(/data-testid="table-row"/g)).toHaveLength(6);
    });

    it('图片没有替代文本时不能通过', () => {
        expect(requireAlt('屋顶示例')).toBe('屋顶示例');
        expect(() => requireAlt('  ')).toThrow('图片缺少替代文本');
    });

    it('空状态给出下一步，称呼和推送窗口按规则', () => {
        expect(emptyNextStep(false)).toContain('下一步');
        expect(salutation('ci_owner', '王')).toBe('王总');
        expect(salutation('ci_owner', '王', 'none')).toBe('');
        expect(salutation('researcher', '周', 'role', 'student')).toBe('同学');
        expect(allowPush('2026-10-27T09:00:00+08:00')).toBe(true);
        expect(allowPush('2026-10-27T07:00:00+08:00')).toBe(false);
        expect(allowPush('2026-10-01T10:00:00+08:00')).toBe(false);
        expect(allowPush('2026-10-01T10:00:00+08:00', '周报')).toBe(true);
        expect(allowPush('2026-01-04T09:00:00+08:00')).toBe(true);
    });

    it('旧档位标识映射后存量值不变', () => {
        expect(storedPlanId('standard')).toBe('pro');
        expect(storedPlanId('professional')).toBe('full');
        expect(canonicalPlanId('pro')).toBe('standard');
        expect(canonicalPlanId('full')).toBe('professional');
    });

    it('排版、动效和公文封面', () => {
        expect(spaceCjkLatin('光伏100kW')).toBe('光伏 100 kW');
        expect(chartMotionMs).toBeLessThanOrEqual(200);
        expect(chartPalette(true)[0]).not.toBe(chartPalette(false)[0]);
        expect(gazetteCoverOk('资料汇编 · 非正式文件')).toBe(true);
        expect(gazetteCoverOk('资料汇编')).toBe(false);
    });
});
