import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('incentives production build constraints', () => {
  it('does not put a test file in src/pages, which Next compiles as a route', () => {
    const names = readdirSync(join(process.cwd(), 'src/pages'));
    expect(names.filter((name) => name.includes('.test.'))).toEqual([]);
  });

  it('paints role=switch in global CSS so a missing Tailwind utility cannot hide it', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toContain("button[role='switch']");
    expect(css).toContain('width: 44px');
    expect(css).toContain('height: 24px');
    expect(css).toContain("button[role='switch'][aria-checked='true']");
    expect(css).toContain('button[role=\'switch\']:focus-visible');
  });
});
