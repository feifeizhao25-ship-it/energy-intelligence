import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegendToolsSummary } from './ResourceMapPage';

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
    expect(page).toContain('aria-expanded={open}');
    expect(page).toContain("const label = open ? '收起' : '展开'");
    expect(page).toContain('bottom-[calc(9rem+env(safe-area-inset-bottom))]');
    expect(page).toContain('请在地图上点击任意位置，或在上方搜索地址');
    expect(map).toContain('bottom-[calc(5.75rem+env(safe-area-inset-bottom))]');
    expect(map).toContain('sm:top-3');
    expect(css).toMatch(/details\.map-side-tools > \.map-side-tools-body\s*\{[^}]*display:\s*flex !important/);
  });

  it('图例开关展开后读作收起，并带上 aria-expanded', () => {
    const closed = renderToStaticMarkup(createElement(LegendToolsSummary, { open: false }));
    const open = renderToStaticMarkup(createElement(LegendToolsSummary, { open: true }));
    expect(closed).toContain('aria-label="展开"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('>展开<');
    expect(open).toContain('aria-label="收起"');
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('>收起<');
    expect(open).not.toContain('aria-label="展开"');
  });
});
