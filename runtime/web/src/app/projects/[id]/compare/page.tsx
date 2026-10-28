import { PageHeader } from '@/components/ui/design-system';
import { AppChrome } from '@/components/layout/AppChrome';

/** 方案对比需要两次已保存的测算。没有记录时不展示示例收益率或投资额。 */
export default function ComparePage() {
    return (
        <AppChrome>
        <main className="mx-auto min-w-0 max-w-3xl space-y-4">
            <PageHeader
                kicker="对比"
                title="方案对比"
                crumbs={[{ href: '/projects', label: '项目' }]}
                summary="保存两次测算后再对比。没有记录时不展示内部收益率、度电成本或初始投资。"
            />
            <section className="ei-panel">
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                    还没有可对照的测算记录。这里不展示示例内部收益率、度电成本或初始投资。
                </p>
            </section>
        </main>
        </AppChrome>
    );
}
