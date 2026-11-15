export type OnboardingSkipResult = 'blocked' | 'saved' | 'failed';

export function onboardingSkipAllowed(ageConfirmed: boolean): boolean {
    return ageConfirmed === true;
}

/**
 * 「我是老用户，跳过引导」只有在年龄确认已勾选、并且服务端收下确认之后，才进入工作台。
 */
export async function runOnboardingSkip(options: {
    ageConfirmed: boolean;
    post: (body: { ageConfirmed: true; preferences: { ageConfirmed: true } }) => Promise<{ ok: boolean }>;
    push: (href: string) => void;
}): Promise<OnboardingSkipResult> {
    if (!onboardingSkipAllowed(options.ageConfirmed)) return 'blocked';
    try {
        const response = await options.post({
            ageConfirmed: true,
            preferences: { ageConfirmed: true },
        });
        if (!response.ok) return 'failed';
        options.push('/dashboard');
        return 'saved';
    } catch {
        return 'failed';
    }
}
