import { AGE_LOOKUP_UNAVAILABLE_MESSAGE, safeAgeRetryPath } from '@/lib/auth/age-status';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 国内版年龄门查库失败时停在这里。
 * 只展示稍后重试，不收集年龄确认，也不提交引导。
 */
export default async function AgeLookupUnavailablePage({ searchParams }: { searchParams: SearchParams }) {
    const params = await searchParams;
    const raw = params.next;
    const retryHref = safeAgeRetryPath(Array.isArray(raw) ? raw[0] : raw);

    return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-700/50 bg-slate-800/50 p-8 text-center md:p-12">
                <h1 className="text-2xl font-black text-white md:text-3xl">{AGE_LOOKUP_UNAVAILABLE_MESSAGE}</h1>
                <a
                    href={retryHref}
                    className="mt-8 inline-flex items-center justify-center rounded-xl bg-green-500 px-6 py-4 font-bold text-white"
                >
                    重试
                </a>
            </div>
        </main>
    );
}
