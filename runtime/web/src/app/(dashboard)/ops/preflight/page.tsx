import { PageHeader } from '@/components/ui/design-system';
import { BANNED_OVERSEAS, presentOverseas } from '@/lib/ops/banned-overseas';

export default function PreflightPage() {
    const present = presentOverseas();
    return (
        <main className="mx-auto min-w-0 max-w-3xl space-y-4">
            <PageHeader
                kicker="运维"
                title="上线预检"
                crumbs={[{ href: '/dashboard', label: '总览' }, { href: '/ops/preflight', label: '预检' }]}
                summary="国内路径拒绝下列海外变量。这里只列出变量名，不显示值。空字符串视为未配置。"
            />
            <section className="ei-panel">
                <h2 className="font-medium">当前进程里已出现的海外变量</h2>
                {present.length === 0
                    ? <p className="mt-2 text-sm">没有发现已配置的海外变量。</p>
                    : <ul className="mt-2 list-disc pl-5 text-sm">{present.map((name) => <li key={name}>{name}</li>)}</ul>}
            </section>
            <section className="ei-panel">
                <h2 className="font-medium">检查名单（{BANNED_OVERSEAS.length}）</h2>
                <ul className="mt-2 columns-1 text-sm text-[var(--ink-soft)] sm:columns-2">
                    {BANNED_OVERSEAS.map((name) => <li key={name} className="break-all">{name}</li>)}
                </ul>
            </section>
        </main>
    );
}
