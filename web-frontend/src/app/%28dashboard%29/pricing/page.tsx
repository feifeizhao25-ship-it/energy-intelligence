'use client';

import React from 'react';
import {
    Check,
    Crown,
    Zap,
    Sparkles,
    Ship,
    ShieldCheck,
    ChevronRight,
    HelpCircle,
    ArrowRight,
    Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PricingPage() {
    const plans = [
        {
            name: '初创版 / Starter',
            price: '0',
            desc: '适合个人学习与小型户用光伏初步估算',
            features: [
                '基础光伏收益测算 (10项指标)',
                'NASA 气象数据基础调用',
                '社区问答广场访问',
                '基础 AI 助手 (每日20次对话)',
                '标准 PDF 报告导出'
            ],
            cta: '立即开始',
            recommended: false,
            color: 'slate'
        },
        {
            name: '专业版 / Professional',
            price: '199',
            period: '/ 月',
            desc: '专为新能源工程师与投资分析师设计',
            features: [
                '全量三合一引擎 (光/风/储)',
                '工程级 IRR 财务分析 (118项参数)',
                '2.4亿篇文献与政策库全文检索',
                '无限次 AI 专家决策分析',
                '自定义品牌测算报告',
                '多场景综合对比工具'
            ],
            cta: '免费试用 7 天',
            recommended: true,
            color: 'emerald'
        },
        {
            name: '企业版 / Enterprise',
            price: '899',
            period: '/ 月',
            desc: '为大型项目开发、EPC 企业提供统筹能力',
            features: [
                '多省份/多电站集中运维看板',
                '10min 级精准资源气象模拟',
                'API 接口私有化调用权限',
                '1对1 资深电力系统架构师咨询',
                '专属服务器算力保障',
                '全员协同项目管理空间'
            ],
            cta: '联系我们',
            recommended: false,
            color: 'slate'
        }
    ];

    const faqs = [
        { q: '专业版的 118 项参数包括什么？', a: '包括详细的衰减率模型、融资贷款分时还款、增值税退税抵扣、深度环境参数等精细化财务指标。' },
        { q: '我可以随时取消订阅吗？', a: '是的，您可以随时在个人设置中取消续费，已支付的周期将继续生效至结束。' },
        { q: '企业版支持内网部署吗？', a: '我们提供私有化部署方案，请联系我们的商务团队进行定制化需求对接。' }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* Header Section */}
            <div className="bg-white pt-32 pb-24 px-4 md:px-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-green-500/5 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest mx-auto">
                        <Crown className="w-4 h-4" />
                        Membership System
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter leading-none">
                        释放您的 <br />
                        <span className="text-green-500">新能源规划潜力</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-xl max-w-2xl mx-auto">
                        从简单的户用估算到工程级的 IRR 分析，选择最适合您的算力模组。
                    </p>

                    <div className="flex items-center justify-center gap-4 pt-4">
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                    {String.fromCharCode(64 + i)}
                                </div>
                            ))}
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />)}
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trusted by 12,000+ Engineers</p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto -mt-12 px-4 md:px-8">
                {/* Pricing Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {plans.map((plan, i) => (
                        <div
                            key={i}
                            className={cn(
                                "relative bg-white rounded-[64px] border p-12 flex flex-col transition-all duration-500 hover:-translate-y-2",
                                plan.recommended
                                    ? "border-green-500 shadow-2xl shadow-green-500/10 z-10 scale-105"
                                    : "border-slate-100 shadow-xl shadow-slate-900/5"
                            )}
                        >
                            {plan.recommended && (
                                <div className="absolute top-0 right-12 bg-green-500 text-white px-6 py-2 rounded-b-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-10">
                                <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{plan.name}</h3>
                                <p className="text-slate-400 text-xs font-medium leading-relaxed">{plan.desc}</p>
                            </div>

                            <div className="flex items-baseline gap-1 mb-10">
                                <span className="text-sm font-black text-slate-400">¥</span>
                                <span className="text-6xl font-black text-slate-900 tracking-tighter">{plan.price}</span>
                                {plan.period && <span className="text-sm font-black text-slate-400">{plan.period}</span>}
                            </div>

                            <div className="space-y-6 mb-12 flex-1">
                                {plan.features.map((feature, j) => (
                                    <div key={j} className="flex items-start gap-3 group">
                                        <div className={cn(
                                            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                                            plan.recommended ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                                        )}>
                                            <Check className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button className={cn(
                                "w-full py-6 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl",
                                plan.recommended
                                    ? "bg-green-500 text-white hover:bg-green-600 shadow-green-500/20"
                                    : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/10"
                            )}>
                                {plan.cta}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Additional Value Proposition */}
                <div className="mt-32 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center px-4">
                    <div className="space-y-10">
                        <div className="space-y-4 text-center lg:text-left">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
                                为什么选择 <span className="text-green-500">智库会员</span> ？
                            </h2>
                            <p className="text-slate-500 font-medium text-lg leading-relaxed">
                                我们不仅提供数据，更提供深入新能源行业的“洞察主权”。
                            </p>
                        </div>

                        <div className="space-y-8">
                            {[
                                { title: '算力保障', desc: '即使在用电高峰期，您的收益测算也能在 1 秒内完成。', icon: Zap },
                                { title: '数据主权', desc: '支持本地化离线导出，您的项目数据完全受加密保护。', icon: ShieldCheck },
                                { title: 'AI 合规性', desc: 'AI 生成的报告均通过了电力系统主流设计院的合规性核验。', icon: Sparkles }
                            ].map((v, i) => (
                                <div key={i} className="flex gap-6 group">
                                    <div className="w-14 h-14 bg-white rounded-3xl border border-slate-100 flex items-center justify-center shadow-lg shadow-slate-900/5 group-hover:bg-green-500 group-hover:text-white transition-all">
                                        <v.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-lg font-black text-slate-900 group-hover:text-green-600 transition-colors uppercase tracking-tight">{v.title}</h4>
                                        <p className="text-sm font-medium text-slate-500 leading-relaxed">{v.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[64px] p-12 lg:p-20 text-white flex flex-col justify-between relative overflow-hidden h-[500px]">
                        <div className="absolute top-0 right-0 p-12 opacity-10">
                            <Ship className="w-64 h-64 rotate-12" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-3xl font-black mb-6 tracking-tighter leading-tight">
                                面向大型项目？<br />
                                <span className="text-green-400">寻找定制化方案</span>
                            </h3>
                            <p className="text-slate-400 font-medium leading-relaxed mb-12">
                                如果您需要集成到现有 ERP 系统或需要大规模私网部署，我们的专业团队可提供全栈新能源 SaaS 定制。
                            </p>
                        </div>
                        <button className="relative z-10 w-fit flex items-center gap-4 bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-sm hover:bg-green-500 hover:text-white transition-all shadow-2xl">
                            立即预约演示 <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="mt-32 max-w-3xl mx-auto space-y-12">
                    <h2 className="text-2xl font-black text-slate-900 text-center uppercase tracking-widest flex items-center justify-center gap-4">
                        <HelpCircle className="w-6 h-6 text-slate-300" />
                        常见问题解答
                    </h2>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-black text-slate-900 group-hover:text-green-600 transition-colors">{faq.q}</h4>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                                </div>
                                <p className="text-sm font-medium text-slate-500 leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
