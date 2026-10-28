import { PageHeader } from '@/components/ui/design-system';
import pending from '@/data/policy-pending.json';

export default function PolicyDiffPage() {
    return (
        <main className="mx-auto min-w-0 max-w-3xl space-y-4">
            <PageHeader
                kicker="运维"
                title="政策差异"
                crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/ops/policy-diff', label: '差异' }]}
                summary="夹具 · 待审批 · 尚未发布。下列条目不会进入已审核政策库。"
            />
            <p className="ei-panel text-sm">{pending.note}</p>
            <ul className="space-y-3">
                {pending.items.map((item) => (
                    <li key={item.source_id} className="ei-panel">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-[var(--ink-soft)]">{item.region} · {item.published}</p>
                        <p className="mt-2 text-sm">适用期：{item.applicability}</p>
                        <p className="mt-2 text-sm">{item.diff.excerpt}</p>
                        <p className="mt-2 text-xs text-[var(--ink-soft)]">变更 {item.diff.changed ? '有' : '无'} · 已发布 {pending.published} 条</p>
                    </li>
                ))}
            </ul>
        </main>
    );
}
