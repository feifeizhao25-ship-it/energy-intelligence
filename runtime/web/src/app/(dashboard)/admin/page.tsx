import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

export default async function AdminPage() {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase() || '';
    const allow = (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (!session?.user) return <p className="text-sm text-slate-700">请先登录。</p>;
    if (!allow.includes(email)) return <p className="text-sm text-slate-700">当前账号不在管理名单中。</p>;
    return <div className="mx-auto max-w-2xl space-y-3 text-slate-900">
        <h1 className="text-2xl font-black">管理台</h1>
        <p className="text-sm leading-6 text-slate-600">名单来自服务端配置。本页不展示密钥，也不改会员价格。支付、短信和模型是否就绪见服务状态页。</p>
        <p className="text-sm">当前账号已通过名单校验。</p>
    </div>;
}
