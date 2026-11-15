import { enforceAgeConfirmation } from '@/lib/auth/age-confirmation';
import { DashboardShell } from './dashboard-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await enforceAgeConfirmation();
    return <DashboardShell>{children}</DashboardShell>;
}
