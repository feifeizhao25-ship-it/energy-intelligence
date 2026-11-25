import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('能23 可见文案', () => {
    it('页签写全成员账号管理，测算入口写储能系统', () => {
        const enterprise = readFileSync(join(__dirname, 'enterprise/page.tsx'), 'utf8');
        const calculator = readFileSync(join(__dirname, 'calculator/page.tsx'), 'utf8');
        expect(enterprise).toContain("label: '成员账号管理'");
        expect(enterprise).not.toContain("label: '成员账号管'");
        expect(calculator).toContain("title: '储能系统'");
        expect(calculator).not.toContain('能源存储系统');
    });
});
