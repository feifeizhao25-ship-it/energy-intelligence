'use client';

import React, { useState } from 'react';
import {
    Building2,
    Users,
    ShieldCheck,
    Palette,
    FileSpreadsheet,
    ArrowUpRight,
    Plus,
    Settings,
    Mail,
    ChevronRight,
    Sparkles,
    Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EnterpriseCenterPage() {
    const [activeTab, setActiveTab] = useState('accounts');

    const accounts = [
        { name: '李明', email: 'liming@example.com', role: '项目经理', status: 'Active', projects: 12 },
        { name: '王芳', email: 'wangfang@example.com', role: '分析师', status: 'Active', projects: 5 },
        { name: '张伟', email: 'zhangwei@example.com', role: '审阅员', status: 'Pending', projects: 0 },
    ];

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
                                Enterprise Management
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
                                企业 <span className="text-blue-500">管理中心</span>
                            </h1>
                            <p className="text-slate-400 font-bold text-lg max-w-2xl">
                                集中管理多子账号权限、自定义企业白标报告，助力团队规模化能源资产评估。
                            </p>
                        </div>
                        <button className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            添加企业成员
                        </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-12">
                        {[
                            { label: '活跃席位', value: '18 / 50', icon: Users },
                            { label: '本月生成报告', value: '1,245', icon: FileSpreadsheet },
                            { label: '团队平均 IRR', value: '16.5%', icon: Sparkles },
                            { label: '白标模板', value: '3套', icon: Palette },
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
                            { id: 'whitelabel', label: '品牌白标设置', icon: Palette },
                            { id: 'templates', label: '报告模板库', icon: Layout },
                            { id: 'security', label: '安全与审计', icon: ShieldCheck },
                            { id: 'api', label: 'API 接口管理', icon: Settings },
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
                                        可用席位剩余: 32
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
                                                            acc.status === 'Active' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
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
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                                <div className="bg-white rounded-[48px] p-12 border border-slate-100 shadow-sm space-y-12">
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-slate-900">报告品牌设置</h3>
                                        <p className="text-slate-400 text-sm font-medium">配置您生成的所有 PDF 报告、分享链接的品牌展示风格。</p>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-12">
                                        <div className="space-y-6">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">企业 Logo (建议 PNG/SVG)</label>
                                            <div className="border-2 border-dashed border-slate-100 rounded-[32px] p-12 flex flex-col items-center gap-4 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group">
                                                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                    <Plus className="w-6 h-6" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-400">点击上传或拖拽文件</span>
                                            </div>
                                        </div>
                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">主色调设置</label>
                                                <div className="flex gap-4">
                                                    {['#22C55E', '#3B82F6', '#6366F1', '#EC4899', '#0F172A'].map(c => (
                                                        <button key={c} className="w-12 h-12 rounded-2xl shadow-lg hover:scale-110 transition-transform" style={{ backgroundColor: c }}></button>
                                                    ))}
                                                    <button className="w-12 h-12 rounded-2xl border-2 border-slate-100 flex items-center justify-center text-slate-300 hover:border-slate-900 transition-colors">
                                                        <Plus className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">报告页脚水印文本</label>
                                                <input type="text" placeholder="例如：© 2026 技术支持由 XXX 能源公司提供" className="w-full bg-slate-50 p-4 rounded-2xl border-none outline-none font-bold text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-8 border-t border-slate-50">
                                        <button className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 hover:bg-blue-600 transition-all">
                                            保存全局白标设置
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(activeTab !== 'accounts' && activeTab !== 'whitelabel') && (
                            <div className="bg-slate-100 rounded-[48px] p-20 text-center space-y-6 border border-dashed border-slate-300">
                                <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center">
                                    <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight">企业级功能开发中</h4>
                                <p className="text-slate-500 font-medium max-w-sm mx-auto">
                                    此模块涉及 118 项核心功能中的企业管理部分，我们的工程师正在全力构建中。
                                </p>
                                <button className="text-blue-500 font-black text-[10px] uppercase tracking-widest hover:underline">
                                    查看开发进度看板 <ArrowUpRight className="inline w-3 h-3 ml-1" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
