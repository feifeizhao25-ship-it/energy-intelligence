export type OnboardingSkipResult = 'blocked' | 'saved' | 'failed';

/** 与 isCnEdition 相同的判断。写在这里是为了让引导页（客户端）不必打进服务端 AI 路由。 */
export function isCnOnboardingEdition(): boolean {
    return (process.env.NEXT_PUBLIC_APP_EDITION || process.env.APP_EDITION || '').toLowerCase() === 'cn';
}

export function onboardingSkipAllowed(ageConfirmed: boolean, cn = isCnOnboardingEdition()): boolean {
    if (!cn) return true;
    return ageConfirmed === true;
}

/**
 * 国内版：「我是老用户，跳过引导」只有在年龄确认已勾选、并且服务端收下确认之后，才进入工作台。
 * 国际版：保持原先行为，不勾选也可以直接进入工作台，不调用引导接口。
 */
export async function runOnboardingSkip(options: {
    ageConfirmed: boolean;
    post: (body: { ageConfirmed: true; preferences: { ageConfirmed: true } }) => Promise<{ ok: boolean }>;
    push: (href: string) => void;
}): Promise<OnboardingSkipResult> {
    if (!onboardingSkipAllowed(options.ageConfirmed)) return 'blocked';
    if (!isCnOnboardingEdition()) {
        options.push('/dashboard');
        return 'saved';
    }
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
