/**
 * 国内版 /assistant、/dashboard、/login 的无障碍约束。
 * 图标按钮要有名字；次要文字用对比度至少 4.5:1 的令牌，不再用 text-slate-400。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname);

function lin(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

function contrast(fg: string, bg: string) {
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function token(css: string, block: string, name: string) {
  const source = block === ':root'
    ? css.slice(css.indexOf(':root'), css.indexOf('.dark'))
    : css.slice(css.indexOf('.dark {'));
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`missing ${block} ${name}`);
  return match[1];
}

describe('国内版关键页的对比度与按钮名', () => {
  const css = readFileSync(join(SRC, 'globals.css'), 'utf8');
  const assistant = readFileSync(join(SRC, '(dashboard)/assistant/page.tsx'), 'utf8');
  const dashboard = readFileSync(join(SRC, '(dashboard)/dashboard/page.tsx'), 'utf8');
  const login = readFileSync(join(SRC, 'login/login-form.tsx'), 'utf8');

  it('根视口允许缩放，登录窄屏有标题，引导和助手各有一层 main', () => {
    const rootLayout = readFileSync(join(SRC, 'layout.tsx'), 'utf8');
    const localeLayout = readFileSync(join(SRC, '[locale]/layout.tsx'), 'utf8');
    for (const source of [rootLayout, localeLayout]) {
      expect(source).not.toMatch(/maximumScale\s*:/);
      expect(source).not.toMatch(/userScalable\s*:/);
      expect(source).not.toContain('maximum-scale');
      expect(source).not.toContain('user-scalable');
    }
    expect(login).toContain('<h1 className="sr-only lg:hidden">{copy.title}</h1>');
    const onboarding = readFileSync(join(SRC, 'onboarding/page.tsx'), 'utf8');
    expect(onboarding.match(/<main\b/g)).toHaveLength(1);
    expect(assistant).not.toContain('<main');
    const chrome = readFileSync(join(SRC, '../components/layout/AppChrome.tsx'), 'utf8');
    expect(chrome.match(/<main\b/g)).toHaveLength(1);
  });

  it('助手图标按钮有中文名称', () => {
    expect(assistant).toContain('aria-label="复制"');
    expect(assistant).toContain('aria-label="重新生成"');
    expect(assistant).toContain('aria-label="添加附件"');
  });

  it('工作台和登录页不再用 text-slate-400', () => {
    expect(dashboard).not.toContain('text-slate-400');
    expect(login).not.toContain('text-slate-400');
    expect(dashboard).toContain('var(--text-muted)');
    expect(login).toContain('var(--text-muted-inverse)');
  });

  it('登录提交按钮白字在常态和悬停背景上至少 4.5:1', () => {
    // Tailwind 默认 emerald 色阶。600/500 与白字分别约 3.77:1、2.54:1，低于 WCAG AA。
    const emerald: Record<string, string> = {
      '500': '#10b981',
      '600': '#059669',
      '700': '#047857',
      '800': '#065f46',
    };
    const button = login.match(/<button disabled=\{loading \|\| !authConfigured\} className="([^"]+)"/);
    expect(button).not.toBeNull();
    const className = button?.[1] ?? '';
    const bg = className.match(/(?:^|\s)bg-emerald-(\d+)/)?.[1];
    const hover = className.match(/hover:bg-emerald-(\d+)/)?.[1];
    expect(bg).toBeTruthy();
    expect(hover).toBeTruthy();
    expect(contrast('#ffffff', emerald[bg as string])).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', emerald[hover as string])).toBeGreaterThanOrEqual(4.5);
  });

  it('次要文字令牌在对应背景上至少 4.5:1', () => {
    const muted = token(css, ':root', '--text-muted');
    const inverse = token(css, ':root', '--text-muted-inverse');
    const mutedDark = token(css, '.dark', '--text-muted');
    for (const bg of ['#ffffff', '#f8fafc', '#f5f7fa']) {
      expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(inverse, '#020617')).toBeGreaterThanOrEqual(4.5);
    for (const bg of ['#0f172a', '#1b2437']) {
      expect(contrast(mutedDark, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
