import pending from '@/data/policy-pending.json';

export default function PolicyDiffPage() {
    return <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">政策差异 · 待审批</h1>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">夹具 · 待审批 · 尚未发布。{pending.note}</p>
        <ul className="space-y-3">
            {pending.items.map((item) => <li key={item.source_id} className="rounded-xl border p-4">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-slate-600">{item.label} · {item.region} · {item.published}</p>
                <p className="mt-2 text-sm">适用期：{item.applicability}</p>
                <p className="mt-2 text-sm text-slate-700">{item.diff.excerpt}</p>
                <p className="mt-2 text-xs text-slate-400">变更 {item.diff.changed ? '有' : '无'} · 已发布 {pending.published} 条</p>
            </li>)}
        </ul>
    </main>;
}
