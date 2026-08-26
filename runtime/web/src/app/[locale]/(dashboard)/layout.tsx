import Sidebar from '@/components/layout/Sidebar';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import { ChatWidget } from '@/components/support/ChatWidget';
import { OfflineIndicator } from '@/components/network/OfflineIndicator';
import { StationProvider } from '@/contexts/StationContext';
import { MilestoneModal } from '@/components/ui/MilestoneModal';
import { AccessibilityPanel } from '@/components/accessibility/AccessibilityPanel';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <StationProvider>
            <div className="min-h-screen">
                <Sidebar />
                <OnboardingFlow />
                <ChatWidget />
                <OfflineIndicator />
                <MilestoneModal />
                <AccessibilityPanel />
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

