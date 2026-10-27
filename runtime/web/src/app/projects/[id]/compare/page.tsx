/** 方案对比需要两次已保存的测算。没有记录时不展示示例收益率或投资额。 */
export default function ComparePage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <h1 className="text-2xl font-bold text-slate-900">方案对比</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
                还没有可对照的测算记录。这里不展示示例内部收益率、度电成本或初始投资。保存两次测算后再对比。
            </p>
        </main>
    );
}
