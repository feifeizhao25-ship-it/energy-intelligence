'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/layout/PageShell';

type Seat = { id: string; label?: string; role: 'admin' | 'member' | 'readonly_advisor' };

const ROLE_LABEL: Record<Seat['role'], string> = {
    admin: '管理员',
    member: '成员',
    readonly_advisor: '只读顾问',
};

export default function TeamPage() {
    const [seats, setSeats] = useState<Seat[]>([]);
    const [limit, setLimit] = useState(1);
    const [note, setNote] = useState('正在读取团队席位。');
    const [memberId, setMemberId] = useState('');
    const [role, setRole] = useState<Seat['role']>('member');

    async function reload() {
        const response = await fetch('/api/team');
        const body = await response.json();
        setSeats(Array.isArray(body.seats) ? body.seats : []);
        setLimit(typeof body.limit === 'number' ? body.limit : 1);
        setNote(body.authenticated ? '席位来自当前账户，没有示例成员。' : '登录后可以邀请成员。当前没有示例席位。');
    }

    useEffect(() => { void reload(); }, []);

    async function invite() {
        const response = await fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'invite', memberId, role }),
        });
        const body = await response.json();
        setNote(body.reason || (body.ok ? '已加入团队。' : '邀请没有完成。'));
        if (body.ok) {
            setMemberId('');
            await reload();
        }
    }

    async function remove(id: string) {
        await fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', memberId: id }),
        });
        await reload();
    }

    return (
        <PageShell
            summary="团队席位、角色和导出权限与会员档位一致。只读顾问不能导出。"
            facts={[
                { label: '席位上限', value: String(limit) },
                { label: '已用', value: String(seats.length) },
                { label: '剩余', value: String(Math.max(0, limit - seats.length)) },
            ]}
            aside={<p className="text-sm leading-6">满员后新的邀请会被拒绝，并说明席位已满。</p>}
        >
            {seats.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-6 text-sm" data-testid="team-empty">还没有团队成员。</p>
            ) : (
                <ul className="space-y-2 text-sm">
                    {seats.map((seat) => (
                        <li key={seat.id} className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2">
                            <span>{seat.label || seat.id} · {ROLE_LABEL[seat.role] || seat.role} · {seat.role === 'readonly_advisor' ? '不能导出' : '可以导出'}</span>
                            {seat.role !== 'admin' && (
                                <button type="button" className="text-xs underline" onClick={() => void remove(seat.id)}>移除</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
                <input value={memberId} onChange={(event) => setMemberId(event.target.value)} placeholder="成员标识" className="rounded-xl border px-3 py-2 text-sm" />
                <select value={role} onChange={(event) => setRole(event.target.value as Seat['role'])} className="rounded-xl border px-3 py-2 text-sm">
                    <option value="member">成员</option>
                    <option value="readonly_advisor">只读顾问</option>
                </select>
                <button type="button" className="rounded-xl bg-[var(--moss)] px-3 py-2 text-sm text-white" onClick={() => void invite()}>邀请</button>
            </div>
            <p className="mt-3 text-sm text-[var(--ink-soft)]" data-testid="team-note">{note}</p>
        </PageShell>
    );
}
