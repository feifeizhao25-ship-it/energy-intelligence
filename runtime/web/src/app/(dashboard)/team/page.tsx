'use client';

import { useState } from 'react';
import { canExport, inviteMember, removeMember, type TeamSeat } from '@/lib/membership/team-admin';
import { PageShell } from '@/components/layout/PageShell';

const START: TeamSeat[] = [
    { id: '甲', role: 'admin' },
    { id: '乙', role: 'member' },
];

export default function TeamPage() {
    const [seats, setSeats] = useState<TeamSeat[]>(START);
    const [note, setNote] = useState('示例席位，未连接真实团队。');
    const limit = 10;
    return (
        <PageShell
            sample
            summary="团队管理员可以邀请和移除成员。只读顾问不能导出。"
            facts={[
                { label: '席位上限', value: String(limit) },
                { label: '已用', value: String(seats.length) },
                { label: '剩余', value: String(limit - seats.length) },
            ]}
            aside={<p className="text-sm leading-6">满员后新的邀请会被拒绝，并说明席位已满。</p>}
        >
            <ul className="space-y-2 text-sm">
                {seats.map((seat) => (
                    <li key={seat.id} className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2">
                        <span>{seat.id} · {seat.role === 'readonly_advisor' ? '只读顾问' : seat.role === 'admin' ? '管理员' : '成员'} · {canExport(seat.role) ? '可以导出' : '不能导出'}</span>
                        <button type="button" className="text-xs underline" onClick={() => setSeats(removeMember(seats, seat.id))}>移除</button>
                    </li>
                ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl bg-[var(--moss)] px-3 py-2 text-sm text-white" onClick={() => {
                    const next = inviteMember(seats, limit, 'member', `成员${seats.length + 1}`);
                    if (!next.ok) setNote(next.reason);
                    else { setSeats(next.seats); setNote('已加入示例席位。'); }
                }}>邀请成员</button>
                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => {
                    const next = inviteMember(seats, limit, 'readonly_advisor', '顾问');
                    if (!next.ok) setNote(next.reason);
                    else { setSeats(next.seats); setNote('已加入只读顾问。'); }
                }}>邀请只读顾问</button>
            </div>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">{note}</p>
        </PageShell>
    );
}
