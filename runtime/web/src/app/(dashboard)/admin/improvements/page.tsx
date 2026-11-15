import type { ReactNode } from 'react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { PageHeader, DataState } from '@/components/ui/design-system';
import { readProposals, type ImprovementProposal } from '@/lib/improvement/queue';

function tone(status?: string): 'up' | 'down' | 'warn' {
    if (status === 'approved') return 'up';
    if (status === 'pending_review') return 'warn';
    return 'down';
}

function statusLabel(status?: string): string {
    if (status === 'approved') return '已通过，待人工合并';
    if (status === 'pending_review') return '待审';
    return '未完成';
}

function recall(value: number | null | undefined): string {
    if (typeof value !== 'number') return '未测';
    return value.toFixed(3);
}

function ProposalCard({ item }: { item: ImprovementProposal }) {
    const candidates = item.candidates || [];
    return (
        <article className="ei-panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">提案 {item.id || '未编号'}</h2>
                <span className="ei-badge" data-tone={tone(item.status)}>{statusLabel(item.status)}</span>
            </div>
            <p className="text-xs text-[var(--ink-soft)]">{item.created_at || '时间未记录'}</p>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-[var(--ink-soft)]">检索召回</dt><dd className="tabular-nums">{recall(item.metrics?.recall_at_8)}</dd></div>
                <div><dt className="text-[var(--ink-soft)]">上次召回</dt><dd className="tabular-nums">{recall(item.metrics?.previous_recall_at_8)}</dd></div>
                <div><dt className="text-[var(--ink-soft)]">差值</dt><dd className="tabular-nums">{recall(item.metrics?.recall_delta)}</dd></div>
            </dl>
            <p className="text-sm">{item.approval?.submitted ? '审批已提交，等待回传。' : '审批未发出。企业微信未配置时保持待审，不会外发。'}</p>
            {item.approval_note ? <p className="text-sm">{item.approval_note}</p> : null}
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--ink-soft)]">
                {(item.suggestions || []).map((line) => <li key={line}>{line}</li>)}
            </ul>
            {candidates.length > 0 ? (
                <div className="max-w-full overflow-x-auto">
                    <table className="ei-table">
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>许可证</th>
                            </tr>
                        </thead>
                        <tbody>
                            {candidates.slice(0, 8).map((candidate) => (
                                <tr key={`${candidate.url}-${candidate.name}`}>
                                    <td>{candidate.name}</td>
                                    <td>{candidate.license || '未标明'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="text-sm text-[var(--ink-soft)]">这一轮没有新的候选来源。</p>}
            <p className="text-xs text-[var(--ink-soft)]">不会自动生效。通过审批后仍须人工合并进检索与技能配置。</p>
        </article>
    );
}

export default async function ImprovementsPage() {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase() || '';
    const allow = (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const shell = (summary: string, body: ReactNode) => (
        <main className="mx-auto min-w-0 max-w-5xl space-y-4">
            <PageHeader
                kicker="管理"
                title="持续改进"
                crumbs={[{ href: '/admin', label: '管理台' }, { href: '/admin/improvements', label: '改进队列' }]}
                summary={summary}
            />
            {body}
        </main>
    );
    if (!session?.user) return shell('请先登录后再查看改进记录。', <p className="text-sm">请先登录。</p>);
    if (!allow.includes(email)) return shell('当前账号不在管理名单中。', <p className="text-sm">当前账号不在管理名单中。</p>);
    const rows = [...readProposals()].reverse();
    const pending = rows.filter((item) => item.status !== 'approved');
    return shell('这里只展示定时任务写下的提案。公开抓取、检索评测和候选来源都不会自动上线。', (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <section className="ei-panel"><p className="text-xs text-[var(--ink-soft)]">全部记录</p><p className="text-2xl font-semibold tabular-nums">{rows.length}</p></section>
                <section className="ei-panel"><p className="text-xs text-[var(--ink-soft)]">待审</p><p className="text-2xl font-semibold tabular-nums">{pending.length}</p></section>
                <section className="ei-panel"><p className="text-xs text-[var(--ink-soft)]">已通过仍待合并</p><p className="text-2xl font-semibold tabular-nums">{rows.length - pending.length}</p></section>
            </div>
            <p className="text-sm"><Link href="/admin" className="underline">返回管理台</Link></p>
            <DataState status={rows.length ? 'ready' : 'empty'} emptyTitle="还没有改进提案。">
                <div className="space-y-3">
                    {rows.slice(0, 20).map((item) => <ProposalCard key={item.id || item.created_at} item={item} />)}
                </div>
            </DataState>
        </div>
    ));
}
