import registry from '@/lib/entitlements/entitlements.json';
import { effectivePlan } from '@/lib/auth/token-refresh';

const PLAN_KEY: Record<string, string> = {
    FREE: 'free', PRO: 'pro', FULL: 'full', TEAM: 'team', ENTERPRISE: 'enterprise', MAINTENANCE: 'maintenance',
};

export function tierOf(plan: string | null | undefined, expireAt?: Date | null) {
    const effective = effectivePlan(plan, expireAt ?? null);
    const key = PLAN_KEY[effective] || 'free';
    return (registry.tiers as Record<string, {
        name: string;
        quotas: Record<string, number>;
        capabilities?: Record<string, boolean | string>;
        features_zh: string[];
    }>)[key];
}
