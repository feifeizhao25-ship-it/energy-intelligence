import registry from '@/lib/entitlements/entitlements.json';

export type TeamRole = 'admin' | 'member' | 'readonly_advisor';

/** Seat cap from the registry. A separate “5 accounts” note is not applied. */
export function teamSeatLimit(tier = 'team'): number {
    const seats = (registry as { tiers: Record<string, { collaboration?: { team_seats?: number } }> }).tiers[tier]?.collaboration?.team_seats;
    if (typeof seats !== 'number' || seats < 1) throw new Error(`team_seats missing for ${tier}`);
    return seats;
}

export interface TeamSeat {
    id: string;
    role: TeamRole;
}

export function inviteMember(seats: TeamSeat[], limit: number, role: TeamRole, id: string): { ok: true; seats: TeamSeat[] } | { ok: false; reason: string } {
    if (seats.length >= limit) return { ok: false, reason: '席位已满' };
    if (seats.some((seat) => seat.id === id)) return { ok: false, reason: '成员已在团队中' };
    return { ok: true, seats: [...seats, { id, role }] };
}

export function removeMember(seats: TeamSeat[], id: string): TeamSeat[] {
    return seats.filter((seat) => seat.id !== id);
}

export function canExport(role: TeamRole): boolean {
    return role !== 'readonly_advisor';
}
