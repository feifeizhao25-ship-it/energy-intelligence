'use client';

import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { TopBar } from '@/components/layout/TopBar';
import { StationProvider } from '@/contexts/StationContext';

const OnboardingFlow = dynamic(() => import('@/components/onboarding/OnboardingFlow'), { ssr: false });

/** 首页与工作台共用的侧栏、顶栏和移动导航。 */
export function AppChrome({ children }: { children: React.ReactNode }) {
    return (
        <StationProvider>
            <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
                <Sidebar />
                <OnboardingFlow />
                <div className="min-h-screen min-w-0 pt-14 lg:ml-64 lg:pt-0">
                    <TopBar />
                    <main className="min-w-0 p-4 pb-24 lg:p-8 lg:pb-8">
                        {children}
                    </main>
                </div>
                <MobileNav />
            </div>
        </StationProvider>
    );
}
