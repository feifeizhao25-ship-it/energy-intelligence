'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
    User,
    Building,
    Briefcase,
    FileText,
    Save,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AccountDataPanel } from '@/components/account/AccountDataPanel';
import PersonalizationSettings from '@/components/dashboard/PersonalizationSettings';
import { ProfileDraftFields } from '@/components/dashboard/ProfileDraftFields';

export default function ProfileSettingsPage() {
    const { data: session, update } = useSession();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        company: '',
        jobTitle: '',
        industry: '',
        bio: ''
    });

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch('/api/user/profile');
                const data = await res.json();
                if (data.success && data.user) {
                    setFormData({
                        name: data.user.name || '',
                        company: data.user.company || '',
                        jobTitle: data.user.jobTitle || '',
                        industry: data.user.industry || '',
                        bio: data.user.bio || ''
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setStatus(null);

        try {
            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();
            if (result.success) {
                setStatus({ type: 'success', message: '资料已保存' });
                // Optional: Trigger session update if next-auth is configured to handle it
                await update();
            } else {
                setStatus({ type: 'error', message: result.error || '更新失败' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: '连接服务器失败' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">个人资料</h1>
                <p className="text-slate-500 text-sm">完善您的职业背景信息，便于工作台和报告按您的情况展示相关内容。尚未保存时，首页使用通用模板。</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Card Left */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <User className="w-3.5 h-3.5" /> 姓名
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="您的真实姓名"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Building className="w-3.5 h-3.5" /> 所属组织 / 企业
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                        placeholder="例如：国家电网、隆基绿能"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5" /> 当前职务
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.jobTitle}
                                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                        placeholder="例如：高级工程师、项目经理"
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                                    />
                                </div>
                                {/* 「业务领域」已并入下方「工作台个性化 · 关注领域」，避免两处重复填写 */}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5" /> 个人简介 / 领域专长
                                </label>
                                <textarea
                                    rows={4}
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    placeholder="简单描述您的专业背景或研究方向..."
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium resize-none"
                                />
                            </div>
                        </div>

                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            {status && (
                                <div className={`flex items-center gap-2 text-xs font-bold ${status.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {status.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                    {status.message}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="ml-auto bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                保存更新
                            </button>
                        </div>
                    </form>
                    <PersonalizationSettings />
                    <ProfileDraftFields />
                </div>

                {/* Right Info Sidebar */}
                <div className="space-y-6">
                    <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/20 mb-6">
                                <ShieldCheck className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-black tracking-tight mb-3">数据隐私保障</h3>
                            <p className="text-slate-400 text-xs leading-relaxed font-medium mb-6">
                                职业信息仅用于报告署名与 AI 分析的背景说明，数据存放在境内自建数据库，不向第三方出售或提供。
                            </p>
                            <div className="space-y-4">
                                <FeatureItem text="数据存放在境内" />
                                <FeatureItem text="可随时导出全部数据" />
                                <FeatureItem text="可在本页注销账号" />
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ShieldCheck className="w-32 h-32" />
                        </div>
                    </div>

                    <AccountDataPanel phone={(session?.user as { phone?: string } | undefined)?.phone} />

                </div>
            </div>
        </div>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-300">{text}</span>
        </div>
    );
}
