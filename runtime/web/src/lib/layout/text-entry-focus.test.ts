import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isTextEntryElement } from './text-entry-focus';

describe('输入焦点时收起底部导航', () => {
  it('文本框、数字框、多行和下列会收起，按钮和链接不会', () => {
    expect(isTextEntryElement({ tagName: 'INPUT', type: 'number' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'input' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'SELECT' })).toBe(true);
    expect(isTextEntryElement({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTextEntryElement({ tagName: 'INPUT', type: 'button' })).toBe(false);
    expect(isTextEntryElement({ tagName: 'A' })).toBe(false);
    expect(isTextEntryElement(null)).toBe(false);
  });

  it('样式在窄屏用焦点藏起底栏，失焦后不再匹配', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    const nav = readFileSync(join(__dirname, '../../components/layout/MobileNav.tsx'), 'utf8');
    expect(css).toContain('.ei-bottom-nav.is-hidden-for-keyboard');
    expect(css).toMatch(/max-width:\s*1023px/);
    expect(css).toContain('textarea:focus');
    expect(css).toContain('select:focus');
    expect(css).toContain('input:not([type="button"])');
    expect(css).toMatch(/body:has\([\s\S]*input:not\(\[type="button"\]\)[\s\S]*\) \.ei-bottom-nav\s*\{[^}]*display:\s*none/);
    expect(nav).toContain('is-hidden-for-keyboard');
    expect(nav).toContain('visualViewport');
    expect(nav).toContain('isTextEntryElement');
  });
});
