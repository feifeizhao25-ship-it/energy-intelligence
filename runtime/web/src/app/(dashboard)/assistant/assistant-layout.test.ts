import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('助手页高度扣掉顶栏和移动页眉，不再用几乎整屏的高度', () => {
    const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    const css = readFileSync(join(__dirname, '../../../app/globals.css'), 'utf8');
    expect(page).toContain('ei-assistant-frame');
    expect(page).not.toContain('h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]');
    expect(css).toContain('.ei-assistant-frame');
    expect(css).toContain('3.5rem');
    expect(css).toContain('3.25rem');
});
