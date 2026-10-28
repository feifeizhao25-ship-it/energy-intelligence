'use client';

import Sidebar from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import { StationProvider } from '@/contexts/StationContext';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isPublicConversionPage = pathname === '/pricing' || pathname === '/checkout';

    if (isPublicConversionPage) {
        return <StationProvider>{children}</StationProvider>;
    }

    return (
        <StationProvider>
        <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
            <Sidebar />
            <OnboardingFlow />
            <main className="min-h-screen min-w-0 transition-all duration-300 lg:ml-64">
                <div className="p-4 pb-24 pt-16 lg:p-8 lg:pb-8 lg:pt-8">
                    {children}
                </div>
            </main>
            <MobileNav />
        </div>
        </StationProvider>
    );
}
