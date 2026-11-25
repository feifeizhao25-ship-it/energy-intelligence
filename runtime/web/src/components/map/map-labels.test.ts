import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('地图图层按钮用中文', () => {
    it('不再用光伏 GHI 和风电 100M', () => {
        const source = readFileSync(join(__dirname, 'ResourceMapPage.tsx'), 'utf8');
        expect(source).not.toContain('光伏 GHI');
        expect(source).not.toContain('风电 100M');
        expect(source).toContain('光伏辐照');
        expect(source).toContain('风电资源');
    });
});
