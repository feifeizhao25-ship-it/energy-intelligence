import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('资源地图窄屏', () => {
  it('缩放条可放到搜索区下方，图例和工具默认收起', () => {
    const page = readFileSync(join(__dirname, 'ResourceMapPage.tsx'), 'utf8');
    const map = readFileSync(join(__dirname, 'ResourceMap.tsx'), 'utf8');
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    expect(page).toContain('map-side-tools');
    expect(page).toContain('图例与工具');
    expect(page).toContain('辐照分级');
    expect(page.indexOf('<details')).toBeLessThan(page.indexOf('辐照分级'));
    expect(page).not.toContain('<details open');
    expect(map).toContain('bottom-[calc(5.75rem+env(safe-area-inset-bottom))]');
    expect(map).toContain('sm:top-3');
    expect(css).toMatch(/details\.map-side-tools > \.map-side-tools-body\s*\{[^}]*display:\s*flex !important/);
  });
});
