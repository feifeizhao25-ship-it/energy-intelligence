'use client';

import { RoleLanding } from '@/components/home/RoleLanding';
import { homePricingPreview } from '@/lib/entitlements/preview';
import { provincesWithPrices } from '@/lib/pricing/tariffs';

export default function HomePage() {
    return (
        <RoleLanding
            coveredProvinces={provincesWithPrices().length}
            plans={homePricingPreview()}
        />
    );
}
