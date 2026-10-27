export type TeamRole = 'admin' | 'member' | 'readonly_advisor';

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
