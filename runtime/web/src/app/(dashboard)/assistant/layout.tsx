import { enforceAgeConfirmation } from '@/lib/auth/age-confirmation';

export const dynamic = 'force-dynamic';

/** 助手页单独再查一次，避免只改工作台壳子时把未确认年龄的用户放进来。 */
export default async function AssistantLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await enforceAgeConfirmation();
    return children;
}
