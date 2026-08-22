/**
 * 🏰 护城河系统：审计资产库 (Audit Assets Library)
 * 核心：让用户的所有计算快照沉淀为资产，提供防篡改验证
 */

import React from 'react';
import {
    ShieldCheck, Search, Filter,
    ArrowRight, Clock, FileText,
    ChevronRight, BadgeCheck, Zap
} from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { redirect } from 'next/navigation';

async function getSnapshots(userId: string) {
    try {
        // 强制使用 as any 绕过 IDE 尚未同步的 Prisma 类型报错
        return await (prisma as any).calculationSnapshot.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { project: true }
        });
    } catch (e) {
        console.error("Fetch snapshots error:", e);
        return [];
    }
}

export default async function AuditLibraryPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect('/login');
    const userId = session.user.id;
    const snapshots = await getSnapshots(userId);

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1117] py-12 px-6">
            <div className="max-w-7xl mx-auto">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-sm mb-3 px-3 py-1 bg-primary-50 dark:bg-primary-900/20 w-fit rounded-full border border-primary-100 dark:border-primary-800">
                            <ShieldCheck size={16} />
                            受审计的数据资产
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            审计资产库
                        </h1>
                        <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-xl text-lg">
                            您的每一次计算都生成了不可篡改的加密快照。这些快照包含完整的证据链，可直接用于金融评审与合规归档。
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="搜索快照 ID 或项目名称..."
                                className="pl-10 pr-4 py-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 outline-none w-64 transition-all"
                            />
                        </div>
                        <button className="p-3 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors">
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <StatMiniCard
                        label="累计审计快照"
                        value={snapshots.length.toString()}
                        icon={<FileText className="text-blue-500" />}
                    />
                    <StatMiniCard
                        label="审计口径"
                        value="版本化"
                        icon={<BadgeCheck className="text-green-500" />}
                    />
                    <StatMiniCard
                        label="数据可追溯性"
                        value="全量留痕"
                        icon={<Zap className="text-yellow-500" />}
                    />
                </div>

                {/* Assets Table */}
                <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 dark:shadow-none backdrop-blur-xl">
                    <div className="grid grid-cols-6 p-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <div className="col-span-2">审计对象 / ID</div>
                        <div>计算类型</div>
                        <div>口径版本</div>
                        <div>创建时间</div>
                        <div className="text-right">操作</div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {snapshots.length > 0 ? snapshots.map((s: any) => (
                            <div key={s.id} className="grid grid-cols-6 p-6 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                                <div className="col-span-2">
                                    <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                                        {s.project?.name || '单次临时测算'}
                                    </div>
                                    <div className="text-xs font-mono text-slate-400 mt-1 uppercase">
                                        ID: {s.id.substring(0, 12)}...
                                    </div>
                                </div>

                                <div>
                                    <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-bold">
                                        {s.calcType}
                                    </span>
                                </div>

                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                    {s.assumptionVersion}
                                </div>

                                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
                                    <Clock size={14} />
                                    {new Date(s.createdAt).toLocaleDateString()}
                                </div>

                                <div className="text-right">
                                    <Link
                                        href={`/audit/${s.id}`}
                                        className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline"
                                    >
                                        查看报告
                                        <ChevronRight size={16} />
                                    </Link>
                                </div>
                            </div>
                        )) : (
                            <div className="p-20 text-center">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                                    <FileText size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">暂无审计快照</h3>
                                <p className="text-slate-500 text-sm mt-2">点击“测算”开始您的第一次专业能源审计</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Security Footer */}
                <div className="mt-12 p-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] -mr-32 -mt-32 rounded-full" />

                    <div className="relative z-10">
                        <h3 className="text-xl font-bold mb-2">数据主权与物理归档</h3>
                        <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
                            所有审计快照均存储在加密数据库中。您可以申请下载离线版数据库副本，以满足金融机构对数据物理存储的合规性要求。
                        </p>
                    </div>

                    <div className="flex gap-4 relative z-10">
                        <button className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-bold text-sm transition-all">
                            下载全量审计包
                        </button>
                        <button className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-2xl font-bold text-sm shadow-xl shadow-primary-900/20 transition-all flex items-center gap-2">
                            开启实时监控审计
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatMiniCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">{icon}</div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">{value}</div>
        </div>
    );
}
