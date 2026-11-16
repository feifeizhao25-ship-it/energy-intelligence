import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import Page from './page';
import {
    AGE_LOOKUP_UNAVAILABLE_MESSAGE,
    ageLookupUnavailablePath,
    safeAgeRetryPath,
} from '@/lib/auth/age-status';

const LEGAL = '我已年满 16 周岁；未满 16 周岁不得注册或使用。本条待法律顾问确认。';

/** Tailwind 默认色阶。green-500 (#22c55e) 配白字约 2.28:1，低于 WCAG AA。 */
const BUTTON_BG: Record<string, string> = {
    'green-700': '#15803d',
    'green-800': '#166534',
    'emerald-700': '#047857',
    'emerald-800': '#065f46',
};

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

describe('database-down age lookup message', () => {
    it('shows the temporary message and a retry, without the age checkbox or rewards', async () => {
        const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ next: '/assistant' }) }));
        expect(html).toContain(AGE_LOOKUP_UNAVAILABLE_MESSAGE);
        expect(html).toContain('>重试<');
        expect(html).toContain('href="/assistant"');
        expect(html.match(/<main\b/g)).toHaveLength(1);
        expect(html).not.toContain(LEGAL);
        expect(html).not.toContain('age-confirmation');
        expect(html).not.toContain('ageConfirmedAt');
        expect(html).not.toContain('积分');
        expect(html).not.toContain('/api/user/onboarding');

        const unsafe = renderToStaticMarkup(await Page({
            searchParams: Promise.resolve({ next: 'https://evil.example/steal' }),
        }));
        expect(unsafe).toContain('href="/dashboard"');
        expect(unsafe).not.toContain('evil');

        const external = renderToStaticMarkup(await Page({
            searchParams: Promise.resolve({ next: '//evil.example' }),
        }));
        expect(external).toContain('href="/dashboard"');
        expect(external).not.toContain('evil');

        const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        expect(source).toContain('safeAgeRetryPath');
        expect(source).toContain('AGE_LOOKUP_UNAVAILABLE_MESSAGE');
        expect(source).not.toContain('/api/user/onboarding');
        expect(source).not.toContain('ageConfirmedAt');
        expect(source).not.toContain('prisma');
        expect(source).not.toContain('points');
        const messageSource = readFileSync(join(__dirname, '../../../lib/auth/age-status.ts'), 'utf8');
        expect(messageSource).toContain(`'${AGE_LOOKUP_UNAVAILABLE_MESSAGE}'`);
    });

    it('retries only /dashboard or /assistant and leaves pricing exempt from this page', () => {
        expect(safeAgeRetryPath('/dashboard')).toBe('/dashboard');
        expect(safeAgeRetryPath('/assistant')).toBe('/assistant');
        expect(safeAgeRetryPath('/zh/assistant/')).toBe('/assistant');
        expect(safeAgeRetryPath('/en/dashboard')).toBe('/dashboard');
        expect(safeAgeRetryPath('/pricing')).toBe('/dashboard');
        expect(safeAgeRetryPath('/checkout')).toBe('/dashboard');
        expect(safeAgeRetryPath('/onboarding')).toBe('/dashboard');
        expect(safeAgeRetryPath(null)).toBe('/dashboard');
        expect(ageLookupUnavailablePath('/assistant')).toBe('/onboarding/unavailable?next=%2Fassistant');
        expect(ageLookupUnavailablePath('/dashboard')).toBe('/onboarding/unavailable?next=%2Fdashboard');
        expect(ageLookupUnavailablePath('/pricing')).toBe('/onboarding/unavailable?next=%2Fdashboard');
        expect(ageLookupUnavailablePath('https://evil.example')).not.toContain('evil');
    });

    it('重试白字在按钮背景上至少 4.5:1', async () => {
        const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ next: '/dashboard' }) }));
        const rendered = html.match(/<a\b[^>]*class="([^"]*)"[^>]*>[\s\S]*?重试/);
        expect(rendered).not.toBeNull();
        const className = rendered?.[1] ?? '';
        expect(className).toMatch(/(?:^|\s)text-white(?:\s|$)/);
        const tone = className.match(/(?:^|\s)bg-(green|emerald)-(\d+)/);
        expect(tone).not.toBeNull();
        const key = `${tone?.[1]}-${tone?.[2]}`;
        expect(BUTTON_BG[key]).toBeTruthy();
        expect(contrast('#ffffff', BUTTON_BG[key])).toBeGreaterThanOrEqual(4.5);

        expect(html).toContain('>重试<');
        const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        expect(source).toContain('bg-green-700');
        expect(source).not.toContain('bg-green-500');
        expect(source).toContain('重试');
    });
});
