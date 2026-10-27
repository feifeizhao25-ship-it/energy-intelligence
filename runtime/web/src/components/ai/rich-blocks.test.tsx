import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MermaidBlock, readFlow } from '@/components/ai/MermaidBlock';
import { ChartSpecView } from '@/components/charts/ChartSpecView';
import { parseCallouts } from '@/lib/ai/directives';

const markdown = readFileSync(join(__dirname, 'AiMarkdown.tsx'), 'utf8');

describe('富文本块能渲染', () => {
    it('回答渲染器接上定义框、流程图、图表、图片和视频', () => {
        expect(markdown).toContain('parseCallouts');
        expect(markdown).toContain('MermaidBlock');
        expect(markdown).toContain("lang === 'chart'");
        expect(markdown).toContain("lang === 'video'");
        expect(markdown).toContain('MediaFrame');
        expect(markdown).not.toContain('rehype-raw');
        const blocks = parseCallouts(':::定义\n性能比\n:::\n');
        expect(blocks.some((block) => block.type === 'callout' && block.kind === '定义')).toBe(true);
    });

    it('流程图在服务端先画出步骤，无效图表给出提示', () => {
        const flow = renderToStaticMarkup(createElement(MermaidBlock, { source: 'flowchart TD\n甲[备案] --> 乙[并网]' }));
        expect(flow).toContain('data-testid="flow-figure"');
        expect(flow).toContain('备案');
        expect(readFlow('flowchart TD\n  甲[<script>alert(1)</script>]').ok).toBe(false);
        const chart = renderToStaticMarkup(createElement(ChartSpecView, { source: { type: 'pie' } }));
        expect(chart).toContain('图表数据无效');
    });
});
