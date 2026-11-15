'use client';

import { AppChrome } from '@/components/layout/AppChrome';
import { StationProvider } from '@/contexts/StationContext';
import { usePathname } from 'next/navigation';

export function DashboardShell({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const isPublicConversionPage = pathname === '/pricing' || pathname === '/checkout';

    if (isPublicConversionPage) {
        return <StationProvider>{children}</StationProvider>;
    }

    return <AppChrome>{children}</AppChrome>;
}
