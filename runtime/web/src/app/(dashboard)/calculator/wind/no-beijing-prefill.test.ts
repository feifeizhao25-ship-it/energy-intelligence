import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('风电测算不预填北京', () => {
    it('初始坐标不是北京，并写明选定前未核验', () => {
        const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        expect(source).not.toContain('39.9042');
        expect(source).not.toContain("province: '北京'");
        expect(source).toContain('不会自动代入北京');
        expect(source).toContain('未核验');
    });
});
