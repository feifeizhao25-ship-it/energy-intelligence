const storedByCanonical: Record<string, string> = {
    free: 'free',
    standard: 'pro',
    professional: 'full',
    pro: 'pro',
    full: 'full',
    team: 'team',
    enterprise: 'enterprise',
};

const canonicalByStored: Record<string, string> = {
    free: 'free',
    pro: 'standard',
    full: 'professional',
    team: 'team',
    enterprise: 'enterprise',
};

export function storedPlanId(raw: string): string {
    const key = raw.trim().toLowerCase();
    const stored = storedByCanonical[key];
    if (!stored) throw new Error('未知档位');
    return stored;
}

export function canonicalPlanId(stored: string): string {
    const key = stored.trim().toLowerCase();
    const name = canonicalByStored[key];
    if (!name) throw new Error('未知档位');
    return name;
}
