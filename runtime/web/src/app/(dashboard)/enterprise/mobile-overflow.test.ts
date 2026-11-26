import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('企业页在手机宽度不把表格撑出屏幕', () => {
    const page = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(page).toContain('overflow-x-hidden');
    expect(page).toContain('min-w-0');
    expect(page).not.toMatch(/(^|[\s"])min-w-\[36rem\]/);
    expect(page).toContain('sm:min-w-[36rem]');
    expect(page).toContain('px-4');
    expect(page).toContain('sm:pt-32');
});
