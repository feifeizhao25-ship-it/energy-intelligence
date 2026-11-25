import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('政策列表打不开时不说政策库未连接', () => {
    it('接口和首页都改成登录后可再查', () => {
        const route = readFileSync(join(__dirname, '../../app/api/policies/route.ts'), 'utf8');
        const home = readFileSync(join(__dirname, 'HomeAside.tsx'), 'utf8');
        expect(route).not.toContain('政策库未连接');
        expect(home).not.toContain('政策库未连接');
        expect(route).toContain('登录后可以再查已审核政策');
        expect(home).toContain('登录后查看');
    });
});
