/**
 * 老用户跳过引导：未勾选年龄确认不能进入工作台；勾选后要先让服务端收下确认。
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: null, update: jest.fn() }) }));

import OnboardingPage from './page';
import { runOnboardingSkip } from './skip';

const LEGAL = '我已年满 16 周岁；未满 16 周岁不得注册或使用。本条待法律顾问确认。';

describe('onboarding skip age gate', () => {
    beforeEach(() => push.mockClear());

    it('renders the age checkbox unticked and the old-user skip on the first step', () => {
        const html = renderToStaticMarkup(React.createElement(OnboardingPage));
        expect(html).toContain(LEGAL);
        expect(html).toContain('我是老用户，跳过引导');
        expect(html).toContain('data-testid="onboarding-skip"');
        expect(html).toContain('data-testid="age-confirmation"');
        expect(html).not.toMatch(/data-testid="age-confirmation"[^>]*checked/);
        const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
        expect(source).toContain(LEGAL);
        expect(source).toContain('runOnboardingSkip');
        expect(source).not.toContain("router.push('/dashboard')");
    });

    it('skip without the checkbox does not call the API or open the dashboard', async () => {
        const post = jest.fn();
        await expect(runOnboardingSkip({ ageConfirmed: false, post, push })).resolves.toBe('blocked');
        expect(post).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it('skip after ticking persists confirmation before opening the dashboard', async () => {
        const post = jest.fn(async () => ({ ok: true }));
        await expect(runOnboardingSkip({ ageConfirmed: true, post, push })).resolves.toBe('saved');
        expect(post).toHaveBeenCalledWith({ ageConfirmed: true, preferences: { ageConfirmed: true } });
        expect(push).toHaveBeenCalledTimes(1);
        expect(push).toHaveBeenCalledWith('/dashboard');
    });

    it('a refused save does not open the dashboard', async () => {
        const post = jest.fn(async () => ({ ok: false }));
        await expect(runOnboardingSkip({ ageConfirmed: true, post, push })).resolves.toBe('failed');
        expect(push).not.toHaveBeenCalled();
        const postThrows = jest.fn(async () => { throw new Error('offline'); });
        await expect(runOnboardingSkip({ ageConfirmed: true, post: postThrows, push })).resolves.toBe('failed');
        expect(push).not.toHaveBeenCalled();
    });
});
