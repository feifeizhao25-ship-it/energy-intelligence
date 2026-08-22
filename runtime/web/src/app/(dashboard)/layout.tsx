'use client';

import Sidebar from '@/components/layout/Sidebar';
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
        <div className="min-h-screen">
            <Sidebar />
            <OnboardingFlow />
            {/* Responsive: no margin on mobile (< lg), sidebar margin on desktop */}
            <main className="lg:ml-64 min-h-screen transition-all duration-300">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8">
                    {children}
                </div>
            </main>
        </div>
        </StationProvider>
    );
}
