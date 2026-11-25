import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('助手页不写没有出处的增益百分比', () => {
    it('反馈按钮是有帮助和没帮助', () => {
        const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        expect(source).not.toContain('10%-25%');
        expect(source).not.toContain('15%-20%');
        expect(source).toContain('有帮助');
        expect(source).toContain('没帮助');
        expect(source).not.toContain('回答无用');
    });
});
