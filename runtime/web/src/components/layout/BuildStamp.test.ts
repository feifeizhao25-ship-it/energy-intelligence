import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('正式界面不展示提交号', () => {
    it('页脚组件和构建配置都不把提交号写进页面', () => {
        const stamp = readFileSync(join(__dirname, 'BuildStamp.tsx'), 'utf8');
        const config = readFileSync(join(__dirname, '../../../next.config.js'), 'utf8');
        expect(stamp).not.toContain('NEXT_PUBLIC_GIT_SHA');
        expect(stamp).not.toContain('git');
        expect(stamp).toContain('新能源智库');
        expect(config).not.toContain('NEXT_PUBLIC_GIT_SHA');
        expect(config).not.toContain('rev-parse');
    });
});
