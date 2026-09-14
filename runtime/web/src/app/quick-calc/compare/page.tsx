import Link from 'next/link';

export default function ComparePage() {
    return (
        <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-200">
            <section className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-slate-700 bg-slate-900 p-8">
                <Link href="/calculator" className="text-blue-300 underline">返回测算工具</Link>
                <h1 className="text-3xl font-bold text-white">方案比较尚未开放</h1>
                <p className="leading-8">目前还不能把光伏、风电和储能按同一组项目条件进行可靠比较，因此这里不展示收益排名或推荐最佳方案。</p>
                <p className="leading-8 text-slate-400">比较需要核对同一地点、用电情况、投资范围、资料覆盖期及计算假设。单个方案的初步估算不能直接作为组合收益结论。</p>
                <Link href="/calculator/solar" className="inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold text-white">开始光伏初步估算</Link>
                <Link href="/projects" className="block text-blue-300 underline">查看我的项目</Link>
            </section>
        </main>
    );
}
