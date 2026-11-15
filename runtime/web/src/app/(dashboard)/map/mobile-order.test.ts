import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('资源地图手机首屏', () => {
    it('搜索和地图在说明前面，说明收起且原文还在', () => {
        const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        const explanation = readFileSync(join(__dirname, '../../../components/map/MapExplanation.tsx'), 'utf8');
        const css = readFileSync(join(__dirname, '../../../app/globals.css'), 'utf8');
        const explainAt = page.indexOf('order-2 md:order-1');
        const mapAt = page.indexOf('order-1 min-w-0 md:order-2');
        expect(explainAt).toBeGreaterThan(-1);
        expect(mapAt).toBeGreaterThan(explainAt);
        expect(page).toContain('ResourceMapClient');
        expect(page).toContain('省级离线辐照与风速样本。地图请求不访问境外气象。');
        expect(page).toContain('VectorLayerPanel');
        expect(explanation).toContain('<details');
        expect(explanation).toContain('地图说明');
        expect(explanation).toContain('{children}');
        expect(explanation).toContain('md:hidden');
        expect(css).toMatch(/details\.map-explanation > \.map-explanation-body\s*\{[^}]*display:\s*block !important/);
    });
});
