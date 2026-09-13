import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { redirect } from 'next/navigation';

export default async function AuditLibraryPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect('/login');
    let snapshots;
    try {
        snapshots = await prisma.calculationSnapshot.findMany({
            where: { userId: session.user.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
            select: { id: true, calcType: true, createdAt: true, project: { select: { name: true } } },
        });
    } catch {
        return <p role="alert" className="p-8 text-center">计算记录暂时无法读取，请稍后重试。读取失败不代表记录已丢失。</p>;
    }
    return <main className="mx-auto max-w-4xl space-y-6 px-5 py-10 text-slate-800">
        <header className="rounded-2xl bg-slate-900 p-6 text-white">
            <h1 className="text-2xl font-bold">我的计算记录</h1>
            <p className="mt-3 text-sm leading-7 text-slate-300">这里显示您最近保存的最多 50 条记录。保存的结果与来源用于回看和核对，不代表工程审计、收益保证或合规认证。</p>
        </header>
        <Link href="/calculator/solar" className="inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white">新建光伏初步估算</Link>
        {snapshots.length ? <ul className="space-y-3">{snapshots.map(snapshot => <li key={snapshot.id}>
            <Link href={`/audit/${encodeURIComponent(snapshot.id)}`} className="block space-y-2 rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 focus:outline-blue-600">
                <h2 className="font-semibold">{snapshot.project?.name || (snapshot.calcType === 'SOLAR_REVENUE' ? '光伏初步估算' : '计算快照')}</h2>
                <p className="text-sm text-slate-500">{snapshot.createdAt.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）</p>
                <p className="break-all text-xs text-slate-500">记录编号：{snapshot.id}</p>
                <span className="inline-block text-sm text-blue-600">查看保存结果 →</span>
            </Link>
        </li>)}</ul> : <p className="rounded-2xl bg-slate-50 p-6 text-sm">暂无已保存的计算记录。完成一次光伏初步估算后可在这里回看。</p>}
        <p className="text-xs leading-6 text-slate-500">当前页面不提供全量审计包下载或实时监控。历史数据不会自动更新，重新决策前请核对最新资料。</p>
    </main>;
}
