// next-auth 错误页（中文）：替代默认的全英文 /api/auth/error 页。
// authOptions.pages.error 指向这里；常见触发原因是部署缺少 NEXTAUTH_* 配置。
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '登录服务提示 - 新能源智库',
};

const ERROR_TEXT: Record<string, string> = {
    Configuration: '登录服务配置不完整：服务端缺少 NEXTAUTH_URL 或 NEXTAUTH_SECRET 环境变量。请联系管理员完成部署配置。',
    AccessDenied: '本次登录未获授权。如有疑问请联系支持。',
    Verification: '登录链接已失效或已使用，请重新发起登录。',
};

export default function AuthErrorPage({
    searchParams,
}: {
    searchParams: { error?: string };
}) {
    const code = searchParams?.error ?? '';
    const message = ERROR_TEXT[code] ?? '登录过程出现问题，请返回登录页重试。';

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center text-slate-900">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 text-4xl">🔐</div>
            <h1 className="mb-2 text-2xl font-extrabold">暂时无法完成登录</h1>
            <p className="mb-8 max-w-md leading-7 text-slate-500">{message}</p>
            <div className="flex gap-4">
                <Link href="/login" className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white hover:bg-emerald-500">
                    返回登录页
                </Link>
                <Link href="/" className="rounded-xl bg-slate-100 px-6 py-2.5 font-bold text-slate-900 hover:bg-slate-200">
                    回首页
                </Link>
            </div>
        </main>
    );
}
