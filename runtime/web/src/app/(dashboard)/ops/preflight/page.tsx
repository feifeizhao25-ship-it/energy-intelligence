import { BANNED_OVERSEAS, presentOverseas } from '@/lib/ops/banned-overseas';

export default function PreflightPage() {
    const present = presentOverseas();
    return <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-2xl font-bold">上线预检</h1>
        <p className="text-sm text-slate-600">国内路径拒绝下列海外变量。这里只列出变量名，不显示值。空字符串视为未配置。</p>
        <section className="rounded-xl border p-4">
            <h2 className="font-medium">当前进程里已出现的海外变量</h2>
            {present.length === 0
                ? <p className="mt-2 text-sm text-emerald-800">没有发现已配置的海外变量。</p>
                : <ul className="mt-2 list-disc pl-5 text-sm">{present.map((name) => <li key={name}>{name}</li>)}</ul>}
        </section>
        <section className="rounded-xl border p-4">
            <h2 className="font-medium">检查名单（{BANNED_OVERSEAS.length}）</h2>
            <ul className="mt-2 columns-2 text-sm text-slate-700">
                {BANNED_OVERSEAS.map((name) => <li key={name} className="break-all">{name}</li>)}
            </ul>
        </section>
    </main>;
}
