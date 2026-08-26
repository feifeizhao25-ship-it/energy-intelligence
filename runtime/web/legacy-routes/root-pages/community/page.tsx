'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    MessageSquare,
    Search,
    ThumbsUp,
    MessageCircle,
    Sparkles,
    TrendingUp,
    FileText,
    Plus,
    Users,
    CheckCircle2,
    ArrowUpRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommunityPage() {
    const [activeCategory, setActiveCategory] = useState('hot');

    const categories = [
        { id: 'hot', label: '热门讨论', count: 128 },
        { id: 'policy', label: '政策解读', count: 56 },
        { id: 'tech', label: '技术咨询', count: 89 },
        { id: 'finance', label: '金融贷款', count: 34 },
        { id: 'om', label: '运维诊断', count: 42 },
    ];

    const questions = [
        {
            id: 1,
            title: '2026年浙江省最新的分布式光伏补贴政策是什么？',
            desc: '我是在温州有一块厂房，现在想做光伏，不知道今年还有没有补贴，电价怎么计算？是否有分时电价优惠？',
            tags: ['政策解读', '浙江'],
            author: '能源老张',
            authorRole: '电站业主',
            likes: 128,
            replies: 12,
            time: '2小时前',
            hasAiAnswer: true,
            isHot: true
        },
        {
            id: 2,
            title: '分布式风电真的能进村吗？噪音和阴影闪烁标准是多少？',
            desc: '看到国家在搞“千乡万村驭风行动”，想问下风机离村子多远比较合适？是否有最新的环保红线标准？',
            tags: ['风电技术', '驭风行动'],
            author: '王主任',
            authorRole: '乡村级专家',
            likes: 85,
            replies: 5,
            time: '5小时前',
            hasAiAnswer: true,
            isHot: false
        },
        {
            id: 3,
            title: '工商业储能现在投资回收期大概是多久？',
            desc: '在江苏，1MW/2MWh的系统，每天两充两放，大概几年能收回成本？考虑了峰谷电价差和需量电费了吗？',
            tags: ['储能', 'IRR分析'],
            author: '储能李工',
            authorRole: '系统集成师',
            likes: 245,
            replies: 38,
            time: '1天前',
            hasAiAnswer: false,
            isHot: true
        }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header / Search Area */}
            <div className="bg-white border-b border-slate-100 pt-32 pb-12 px-4 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest">
                            <Users className="w-3 h-3" />
                            Expert Community
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-none">
                            新能源 <span className="text-green-500">问答社区</span>
                        </h1>
                        <p className="text-slate-500 font-medium text-lg">500+ 位行业专家实时在线，解决您的每一个工程难题</p>
                    </div>

                    <div className="w-full md:w-96">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-green-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="搜索政策、方案、技术细节..."
                                className="w-full bg-slate-50 p-4 pl-12 rounded-2xl border-2 border-transparent focus:border-green-500 focus:bg-white outline-none font-bold text-sm transition-all text-slate-900"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-12 py-12 px-4 md:px-8">

                {/* 左侧：精简导航 */}
                <div className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">话题分类</h3>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    "w-full flex items-center justify-between px-6 py-4 rounded-2xl font-black text-sm transition-all group text-slate-900",
                                    activeCategory === cat.id
                                        ? "bg-green-500 text-white shadow-xl shadow-green-500/20"
                                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", activeCategory === cat.id ? "bg-white" : "bg-slate-300 group-hover:bg-green-500")} />
                                    {cat.label}
                                </div>
                                <span className={cn("text-[10px]", activeCategory === cat.id ? "text-white/80" : "text-slate-300")}>
                                    {cat.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* AI 专家卡片 */}
                    <div className="bg-slate-900 rounded-[48px] p-8 text-white relative overflow-hidden group shadow-2xl">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-30 transition-opacity">
                            <Sparkles className="w-20 h-20 text-green-500 rotate-12" />
                        </div>
                        <div className="relative z-10">
                            <div className="w-10 h-10 rounded-2xl bg-green-500 flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <h4 className="text-xl font-black mb-3">AI 智讯解答</h4>
                            <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8">
                                发布问题后，AI 将自动检索 <span className="text-white">公开文献</span> 与实时政策库，为您先行生成专业参考答案。
                            </p>
                            <button className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black hover:bg-green-500 hover:text-white transition-all text-[10px] uppercase tracking-widest cursor-pointer">
                                立即匿名提问
                            </button>
                        </div>
                    </div>
                </div>

                {/* 中间：问题列表 */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center justify-between mb-2 px-4">
                        <div className="flex gap-6">
                            {['最新发布', '最多点赞', '悬赏中'].map((tab) => (
                                <button key={tab} className="text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest border-b-2 border-transparent hover:border-green-500 pb-2 transition-all cursor-pointer">
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <button className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all flex items-center gap-2 shadow-xl cursor-pointer">
                            <Plus className="w-4 h-4" />
                            发起提问
                        </button>
                    </div>

                    <div className="space-y-6">
                        {questions.map((q) => (
                            <div key={q.id} className="bg-white rounded-[48px] p-10 border border-slate-100 hover:shadow-2xl hover:shadow-green-500/5 transition-all group relative overflow-hidden">
                                {q.isHot && (
                                    <div className="absolute top-0 right-10 bg-red-500 text-white px-4 py-1.5 rounded-b-2xl text-[10px] font-black uppercase tracking-widest">
                                        Hot Discussion
                                    </div>
                                )}

                                <div className="flex gap-2 mb-6">
                                    {q.tags.map(tag => (
                                        <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-4 py-1.5 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <h2 className="text-2xl font-black text-slate-900 mb-4 group-hover:text-green-600 transition-colors leading-[1.1] tracking-tighter">
                                    {q.title}
                                </h2>
                                <p className="text-slate-500 font-medium text-sm mb-10 leading-relaxed line-clamp-2">
                                    {q.desc}
                                </p>

                                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-6 pt-8 border-t border-slate-50">
                                    <div className="flex items-center gap-6 text-slate-400">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-900">{q.author}</span>
                                            <span className="text-[10px] font-bold text-slate-400 tracking-tight">{q.authorRole}</span>
                                        </div>
                                        <div className="h-6 w-px bg-slate-100 hidden sm:block"></div>
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5 hover:text-red-500 transition-colors cursor-pointer"><ThumbsUp className="w-4 h-4" /> {q.likes}</div>
                                            <div className="flex items-center gap-1.5 hover:text-green-500 transition-colors cursor-pointer"><MessageCircle className="w-4 h-4" /> {q.replies}</div>
                                            <span className="text-slate-300">{q.time}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 w-full sm:w-auto">
                                        {q.hasAiAnswer && (
                                            <div className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                                                <Sparkles className="w-4 h-4 text-green-400" />
                                                AI Verified
                                            </div>
                                        )}
                                        <button className="flex-1 sm:flex-none bg-slate-50 hover:bg-green-500 hover:text-white text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer">
                                            查看详情
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="w-full py-12 text-slate-400 font-black uppercase tracking-[0.3em] hover:text-green-600 transition-all text-sm cursor-pointer">
                        Load More Topics
                    </button>
                </div>

                {/* 右侧：热点与排行 */}
                <div className="space-y-10">
                    <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <TrendingUp className="w-24 h-24" />
                        </div>
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-red-500" /></span>
                            实时热搜榜
                        </h3>
                        <div className="space-y-6 relative z-10">
                            {[
                                { title: '2026年浙江光伏补贴', trend: 'up', val: '2.4w' },
                                { title: '驭风行动环保红线', trend: 'up', val: '1.8w' },
                                { title: '工商业峰谷电价差', trend: 'up', val: '1.5w' },
                                { title: '分布式风机噪音等级', trend: 'down', val: '9.2k' },
                                { title: '融资租赁最新利率', trend: 'up', val: '7.5k' }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 group cursor-pointer">
                                    <span className={cn(
                                        "text-xl font-black tracking-tighter w-4",
                                        i < 3 ? "text-green-500" : "text-slate-200"
                                    )}>{i + 1}</span>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="text-slate-700 font-black group-hover:text-green-600 transition-colors text-xs truncate whitespace-nowrap">{item.title}</div>
                                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">{item.val} 热度</div>
                                    </div>
                                    <ArrowUpRight className={cn(
                                        "w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1",
                                        item.trend === 'up' ? "text-red-500" : "text-slate-300"
                                    )} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></span>
                            活跃专家排行
                        </h3>
                        <div className="space-y-6">
                            {[
                                { name: '储能李工', role: '系统集成师', score: 2450 },
                                { name: '能源老张', role: '资深业主', score: 1820 },
                                { name: '刘博士', role: '光伏科学家', score: 1560 }
                            ].map((expert, i) => (
                                <div key={i} className="flex items-center gap-4 group cursor-pointer">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-green-500 font-black group-hover:bg-green-500 group-hover:text-white transition-all overflow-hidden">
                                        {expert.name[0]}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-black text-slate-900">{expert.name}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{expert.role}</div>
                                    </div>
                                    <div className="text-[10px] font-black text-green-500">{expert.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
