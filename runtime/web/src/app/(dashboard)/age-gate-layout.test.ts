jest.mock('@/lib/auth/age-confirmation', () => ({
    enforceAgeConfirmation: jest.fn(async () => {
        throw new Error('REDIRECT:/onboarding');
    }),
}));
jest.mock('./dashboard-shell', () => ({
    DashboardShell: ({ children }: { children: unknown }) => children,
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import { enforceAgeConfirmation } from '@/lib/auth/age-confirmation';
import DashboardLayout from './layout';
import AssistantLayout from './assistant/layout';

describe('dashboard and assistant layouts', () => {
    beforeEach(() => {
        jest.mocked(enforceAgeConfirmation).mockClear();
    });

    it('dashboard layout asks the age gate before painting the shell', async () => {
        await expect(DashboardLayout({ children: 'workbench' })).rejects.toThrow('REDIRECT:/onboarding');
        expect(enforceAgeConfirmation).toHaveBeenCalledTimes(1);
    });

    it('assistant layout asks the age gate before the chat page', async () => {
        await expect(AssistantLayout({ children: 'chat' })).rejects.toThrow('REDIRECT:/onboarding');
        expect(enforceAgeConfirmation).toHaveBeenCalledTimes(1);
    });
});
