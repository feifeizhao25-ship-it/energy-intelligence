import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('位置选择器在深色页上可读', () => {
  const source = readFileSync(join(__dirname, 'LocationPicker.tsx'), 'utf8');

  it('搜索框和定位按钮使用明确的深色字，不继承页面的浅色文字', () => {
    expect(source).toContain('text-slate-900 caret-slate-900 placeholder:text-slate-500');
    expect(source).toContain('bg-white');
    expect(source).toContain('scheme-light');
    expect(source).toContain('text-slate-800');
    expect(source).toContain('aria-label="定位到当前位置"');
    const button = source.slice(source.indexOf('aria-label="定位到当前位置"') - 280, source.indexOf('aria-label="定位到当前位置"'));
    expect(button).toContain('text-slate-800');
    expect(button).toContain('bg-white');
  });

  it('再次打开时清空搜索词，聚焦时全选，已确认的位置不在这里被清掉', () => {
    const opener = source.slice(source.indexOf('const openPicker'), source.indexOf('}, [isMapOpen]'));
    expect(opener).toContain("setSearchQuery('')");
    expect(opener).toContain('setSearchSession');
    expect(opener).not.toContain('setSelectedLocation(null)');
    expect(source).toContain('field.select()');
    expect(source).toContain('key={searchSession}');
  });
});
