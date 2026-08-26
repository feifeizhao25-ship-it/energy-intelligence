'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
    User,
    Building,
    Briefcase,
    Globe,
    FileText,
    Save,
    ShieldCheck,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Crown
} from 'lucide-react';
import { motion } from 'framer-motion';

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
                setStatus({ type: 'success', message: '资料已成功更新，专家档案已激活' });
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
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">个人资料与专家档案</h1>
                <p className="text-slate-500 text-sm">完善您的职业背景信息，系统将为您提供更精准的行业洞察和报告定制。</p>
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
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Globe className="w-3.5 h-3.5" /> 业务领域
                                    </label>
                                    <select
                                        value={formData.industry}
                                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
                                    >
                                        <option value="">请选择领域</option>
                                        <option value="solar">光伏发电</option>
                                        <option value="wind">风力发电</option>
                                        <option value="storage">储能系统</option>
                                        <option value="grid">智能电网</option>
                                        <option value="finance">新能源投融资</option>
                                        <option value="policy">政策研究</option>
                                    </select>
                                </div>
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
                                您的职业信息仅用于增强 AI 诊断的准确性以及生成专业测算报告的署名。我们严格遵守 GDPR 及国内等级保护标准。
                            </p>
                            <div className="space-y-4">
                                <FeatureItem text="端到端加密存储" />
                                <FeatureItem text="不向第三方披露" />
                                <FeatureItem text="随时可申请注销" />
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <ShieldCheck className="w-32 h-32" />
                        </div>
                    </div>

                    <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100">
                        <h4 className="text-indigo-900 font-black text-sm mb-4 tracking-tight uppercase flex items-center gap-2">
                            <Crown className="w-4 h-4 text-indigo-600" /> 专家权益
                        </h4>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3 text-xs text-indigo-800 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                                测算报告自动生成中英文专家署名
                            </li>
                            <li className="flex items-start gap-3 text-xs text-indigo-800 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                                优先获得行业白皮书与闭门会议邀请
                            </li>
                            <li className="flex items-start gap-3 text-xs text-indigo-800 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                                解锁每日加赠的 10 次 DeepSeek V3 额度
                            </li>
                        </ul>
                    </div>
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
