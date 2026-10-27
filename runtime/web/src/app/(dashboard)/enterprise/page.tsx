'use client';

import React, { useState } from 'react';
import {
    Building2,
    Users,
    ShieldCheck,
    Palette,
    FileSpreadsheet,
    Plus,
    Settings,
    Sparkles,
    Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcurementForm } from '@/components/enterprise/ProcurementForm';

export default function EnterpriseCenterPage() {
    const [activeTab, setActiveTab] = useState('accounts');

    const accounts: { name: string; email: string; role: string; status: string }[] = [];

    return (
        <div className="min-h-screen bg-[#FBFDFF] pb-24">
            {/* Enterprise Header */}
            <div className="bg-slate-900 pt-32 pb-20 px-8 md:px-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-20 opacity-10">
                    <Building2 className="w-80 h-80 text-white" />
                </div>
                <div className="max-w-7xl mx-auto relative z-10 space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                                <ShieldCheck className="w-3 h-3" />
                                企业管理
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                                企业 <span className="text-blue-500">管理中心</span>
                            </h1>
                            <p className="text-slate-400 font-bold text-lg max-w-2xl">
                                上限档含 10 个席位，更多席位按合同增加。本页不提供白标报告或单点登录。
                            </p>
                        </div>
                        <button type="button" disabled className="bg-white/70 text-slate-500 px-8 py-4 rounded-2xl font-black text-xs tracking-widest shadow-xl flex items-center gap-2 cursor-not-allowed">
                            <Plus className="w-4 h-4" />
                            添加成员尚未开放
                        </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-12">
                        {[
                            { label: '含席位', value: '10', icon: Users },
                            { label: '本月生成报告', value: '以导出记录为准', icon: FileSpreadsheet },
                            { label: '收益结论', value: '不在此展示', icon: Sparkles },
                            { label: '品牌定制', value: '未提供', icon: Palette },
                        ].map((s, i) => (
                            <div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
                                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-2">{s.label}</span>
                                <div className="text-2xl font-black text-white flex items-center justify-between">
                                    {s.value}
                                    <s.icon className="w-4 h-4 text-blue-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto py-16 px-8 md:px-12">
                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Navigation Sidebar */}
                    <aside className="w-full lg:w-64 space-y-2">
                        {[
                            { id: 'accounts', label: '成员账号管', icon: Users },
                            { id: 'whitelabel', label: '品牌定制未开通', icon: Palette },
                            { id: 'templates', label: '报告模板库', icon: Layout },
                            { id: 'security', label: '安全与审计', icon: ShieldCheck },
                            { id: 'api', label: 'API 接口管理', icon: Settings },
                            { id: 'procurement', label: '对公采购', icon: FileSpreadsheet },
                        ].map((m) => (
                            <button
                                key={m.id}
                                onClick={() => setActiveTab(m.id)}
                                className={cn(
                                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
                                    activeTab === m.id
                                        ? "bg-slate-900 text-white shadow-xl"
                                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                <m.icon className="w-4 h-4" />
                                {m.label}
                            </button>
                        ))}
                    </aside>

                    {/* Content Area */}
                    <div className="flex-1 space-y-8">
                        {activeTab === 'accounts' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center px-4">
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">成员管理</h3>
                                    <div className="text-xs font-bold text-slate-400 bg-slate-100 px-4 py-2 rounded-full">
                                        席位上限 10，成员名单未连接
                                    </div>
                                </div>
                                <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">成员信息</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">权限角色</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">状态</th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {accounts.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-8 py-10 text-sm text-slate-500">还没有企业成员。这里不展示示例姓名。</td>
                                                </tr>
                                            )}
                                            {accounts.map((acc, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center font-black transition-all">
                                                                {acc.name[0]}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-900">{acc.name}</div>
                                                                <div className="text-xs font-bold text-slate-400">{acc.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 font-bold text-slate-600 text-sm">{acc.role}</td>
                                                    <td className="px-8 py-6">
                                                        <span className={cn(
                                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                                                            acc.status === '已启用' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                                                        )}>
                                                            {acc.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <button className="text-slate-300 hover:text-slate-900 p-2 transition-colors">
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'whitelabel' && (
                            <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm">
                                <h3 className="text-2xl font-black text-slate-900">报告品牌设置</h3>
                                <p className="mt-3 text-sm leading-6 text-slate-600">本页不提供白标报告或标志上传。未开通的设置不在这里做成可点击的表单。</p>
                            </div>
                        )}
                        {activeTab === 'procurement' && <ProcurementForm />}

                        {(activeTab !== 'accounts' && activeTab !== 'whitelabel' && activeTab !== 'procurement') && (
                            <div className="bg-slate-100 rounded-[48px] p-20 text-center space-y-6 border border-dashed border-slate-300">
                                <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center">
                                    <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight">企业级功能开发中</h4>
                                <p className="text-slate-500 font-medium max-w-sm mx-auto">
                                    此企业管理模块尚未开放；当前页面不会模拟已完成的功能或返回伪造结果。
                                </p>
                                <p className="text-sm text-slate-500">没有单独的进度看板。</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
