import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { headers } from 'next/headers';
import {
    ageConfirmationExempt,
    isAgeConfirmed,
    readAgeConfirmed,
    shouldRedirectForAge,
    enforceAgeConfirmation,
    AGE_CONFIRMATION_PATH,
    AGE_GATE_PATH_HEADER,
} from './age-confirmation';

const redirect = jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
});
const headerState: { pathname: string | null } = { pathname: '/dashboard' };
const findUnique = jest.fn();
let session: { user: { id: string } } | null = { user: { id: 'u1' } };

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));
jest.mock('next/headers', () => ({
    headers: jest.fn(async () => ({
        get: (key: string) => (key === 'x-nengjian-pathname' ? headerState.pathname : null),
    })),
}));
jest.mock('next-auth', () => ({ getServerSession: jest.fn(async () => session) }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
    prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

describe('age confirmation redirect', () => {
    beforeEach(() => {
        redirect.mockClear();
        findUnique.mockReset();
        session = { user: { id: 'u1' } };
        headerState.pathname = '/dashboard';
    });

    it('existing confirmed users are not blocked', () => {
        expect(isAgeConfirmed({ profileCompleted: true, ageConfirmedAt: null })).toBe(true);
        expect(shouldRedirectForAge({
            signedIn: true,
            pathname: '/dashboard',
            user: { profileCompleted: true, ageConfirmedAt: null },
        })).toBe(false);
        expect(shouldRedirectForAge({
            signedIn: true,
            pathname: '/assistant',
            user: { profileCompleted: false, ageConfirmedAt: new Date('2026-01-01') },
        })).toBe(false);
    });

    it('unconfirmed signed-in users leave /dashboard and /assistant', () => {
        const user = { profileCompleted: false, ageConfirmedAt: null };
        expect(shouldRedirectForAge({ signedIn: true, pathname: '/dashboard', user })).toBe(true);
        expect(shouldRedirectForAge({ signedIn: true, pathname: '/assistant', user })).toBe(true);
        expect(shouldRedirectForAge({ signedIn: true, pathname: '/zh/assistant', user })).toBe(true);
    });

    it('signed-out users and price pages stay put', () => {
        const user = { profileCompleted: false, ageConfirmedAt: null };
        expect(shouldRedirectForAge({ signedIn: false, pathname: '/dashboard', user })).toBe(false);
        expect(shouldRedirectForAge({ signedIn: true, pathname: '/pricing', user })).toBe(false);
        expect(shouldRedirectForAge({ signedIn: true, pathname: '/checkout', user })).toBe(false);
        expect(ageConfirmationExempt('/zh/pricing')).toBe(true);
        expect(shouldRedirectForAge({ signedIn: true, pathname: '/dashboard', user, lookupFailed: true })).toBe(false);
    });

    it('dashboard layout redirects an unconfirmed user to onboarding', async () => {
        findUnique.mockResolvedValue({ profileCompleted: false, ageConfirmedAt: null });
        await expect(enforceAgeConfirmation()).rejects.toThrow(`REDIRECT:${AGE_CONFIRMATION_PATH}`);
        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 'u1' },
            select: { ageConfirmedAt: true, profileCompleted: true },
        });
    });

    it('assistant path redirects when the header says /assistant', async () => {
        headerState.pathname = '/assistant';
        findUnique.mockResolvedValue({ profileCompleted: false, ageConfirmedAt: null });
        await expect(enforceAgeConfirmation()).rejects.toThrow('REDIRECT:/onboarding');
    });

    it('a stored confirmation does not redirect', async () => {
        findUnique.mockResolvedValue({ profileCompleted: false, ageConfirmedAt: new Date() });
        await expect(enforceAgeConfirmation()).resolves.toBeUndefined();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('an already completed profile is not redirected', async () => {
        findUnique.mockResolvedValue({ profileCompleted: true, ageConfirmedAt: null });
        await expect(enforceAgeConfirmation()).resolves.toBeUndefined();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('does not swallow Next.js dynamic rendering errors', async () => {
        const error = new Error('dynamic');
        (error as Error & { digest: string }).digest = 'DYNAMIC_SERVER_USAGE';
        jest.mocked(headers).mockRejectedValueOnce(error);
        await expect(enforceAgeConfirmation()).rejects.toBe(error);
        expect(findUnique).not.toHaveBeenCalled();
    });

    it('no session and database errors do not redirect', async () => {
        session = null;
        await expect(enforceAgeConfirmation()).resolves.toBeUndefined();
        expect(findUnique).not.toHaveBeenCalled();
        session = { user: { id: 'u1' } };
        findUnique.mockRejectedValue(new Error('db down'));
        await expect(enforceAgeConfirmation()).resolves.toBeUndefined();
        expect(redirect).not.toHaveBeenCalled();
    });

    it('layouts and the path header call the same gate', () => {
        const root = join(__dirname, '..', '..');
        const dashboardLayout = readFileSync(join(root, 'app/(dashboard)/layout.tsx'), 'utf8');
        const assistantLayout = readFileSync(join(root, 'app/(dashboard)/assistant/layout.tsx'), 'utf8');
        const localeLayout = readFileSync(join(root, 'app/[locale]/(dashboard)/layout.tsx'), 'utf8');
        const proxy = readFileSync(join(root, 'proxy.ts'), 'utf8');
        for (const source of [dashboardLayout, assistantLayout, localeLayout]) {
            expect(source).toContain('enforceAgeConfirmation');
            expect(source).toContain("dynamic = 'force-dynamic'");
        }
        expect(proxy).toContain(AGE_GATE_PATH_HEADER);
        expect(readAgeConfirmed({ ageConfirmed: false })).toBe(false);
        expect(readAgeConfirmed({ ageConfirmed: true })).toBe(true);
    });
});
