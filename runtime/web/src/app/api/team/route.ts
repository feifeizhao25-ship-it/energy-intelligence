import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/auth-options';
import { inviteMember, removeMember, teamSeatLimit, type TeamRole, type TeamSeat } from '@/lib/membership/team-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

type Stored = { seats: TeamSeat[] };

function storePath(): string {
    return process.env.TEAM_STORE_PATH || join(process.cwd(), 'data', 'team-seats.json');
}

function readStore(): Record<string, Stored> {
    try {
        return JSON.parse(readFileSync(storePath(), 'utf8')) as Record<string, Stored>;
    } catch {
        return {};
    }
}

function writeStore(data: Record<string, Stored>) {
    const path = storePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data, null, 2));
}

export async function GET() {
    const session = await getServerSession(authOptions).catch(() => null) as { user?: { id?: string; name?: string; email?: string } } | null;
    const userId = session?.user?.id;
    if (!userId) {
        return NextResponse.json({ authenticated: false, seats: [], limit: teamSeatLimit('free'), note: '登录后可以邀请成员。当前没有示例席位。' });
    }
    const stored = readStore()[userId]?.seats;
    const owner: TeamSeat = { id: userId, role: 'admin' };
    const seats = stored?.some((seat) => seat.id === userId) ? stored : [owner, ...(stored || [])];
    return NextResponse.json({
        authenticated: true,
        seats,
        limit: teamSeatLimit('team'),
        ownerLabel: session?.user?.name || session?.user?.email || '账户所有者',
    });
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions).catch(() => null) as { user?: { id?: string } } | null;
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ ok: false, reason: '请先登录' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const store = readStore();
    const current = store[userId]?.seats || [{ id: userId, role: 'admin' as TeamRole }];
    const limit = teamSeatLimit('team');
    if (body.action === 'remove') {
        const seats = removeMember(current, String(body.memberId || ''));
        store[userId] = { seats };
        writeStore(store);
        return NextResponse.json({ ok: true, seats });
    }
    const next = inviteMember(current, limit, (body.role || 'member') as TeamRole, String(body.memberId || '').trim());
    if (!next.ok) return NextResponse.json(next, { status: 409 });
    store[userId] = { seats: next.seats };
    writeStore(store);
    return NextResponse.json({ ok: true, seats: next.seats });
}
