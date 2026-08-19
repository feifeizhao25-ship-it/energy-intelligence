'use client';

import React, { useState } from 'react';
import {
    MessageSquare,
    ThumbsUp,
    MessageCircle,
    Search,
    Plus,
    Filter,
    Clock,
    TrendingUp,
    Star,
    Check,
    User,
    ChevronRight,
    Sparkles,
    X,
    Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data
const mockQuestions = [
    {
        id: '1',
        title: '屋顶装光伏需要什么手续？',
        content: '我家是自建房，想在屋顶装光伏发电，请问需要办理哪些手续？大概多久能装好？',
        author: { name: '阳光生活', avatar: null },
        category: 'installation',
        tags: ['光伏', '安装', '手续'],
        createdAt: new Date('2026-01-13'),
        views: 234,
        likes: 28,
        answers: 5,
        isAnswered: true,
        bestAnswerId: '1',
    },
    {
        id: '2',
        title: '光伏板清洗多久一次比较好？',
        content: '装了半年了，发现发电量有点下降，是不是需要清洗了？',
        author: { name: '新能源小白', avatar: null },
        category: 'maintenance',
        tags: ['光伏', '清洗', '维护'],
        createdAt: new Date('2026-01-12'),
        views: 156,
        likes: 15,
        answers: 3,
        isAnswered: true,
        bestAnswerId: '2',
    },
    {
        id: '3',
        title: '自发自用和全额上网哪个更划算？',
        content: '我家白天基本没人，用电量不大，是选自发自用还是全额上网？',
        author: { name: '犹豫不决', avatar: null },
        category: 'policy',
        tags: ['电价', '收益', '政策'],
        createdAt: new Date('2026-01-14'),
        views: 89,
        likes: 8,
        answers: 2,
        isAnswered: false,
    },
];

const categories = [
    { id: 'all', name: '全部', icon: MessageSquare },
    { id: 'installation', name: '安装咨询', icon: Plus },
    { id: 'maintenance', name: '运维问题', icon: Clock },
    { id: 'policy', name: '政策补贴', icon: Star },
    { id: 'technology', name: '技术讨论', icon: TrendingUp },
];

const sortOptions = [
    { id: 'latest', name: '最新' },
    { id: 'hot', name: '最热' },
    { id: 'unanswered', name: '待回答' },
];

export default function CommunityPage() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('latest');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAskModal, setShowAskModal] = useState(false);

    const filteredQuestions = mockQuestions.filter(q => {
        if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;
        if (searchQuery && !q.title.includes(searchQuery) && !q.content.includes(searchQuery)) return false;
        if (sortBy === 'unanswered' && q.isAnswered) return false;
        return true;
    });

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-6 py-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">问答社区</h1>
                            <p className="text-slate-500 mt-1">分享经验，互帮互助</p>
                        </div>
                        <button
                            onClick={() => setShowAskModal(true)}
                            className="bg-primary-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary-600 transition-colors shadow-primary"
                        >
                            <Plus className="w-5 h-5" />
                            我要提问
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="搜索问题..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border-2 border-transparent focus:border-primary-500 focus:bg-white outline-none font-medium"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-6">
                {/* Categories */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all",
                                selectedCategory === cat.id
                                    ? "bg-primary-500 text-white shadow-primary"
                                    : "bg-white text-slate-600 border border-slate-200 hover:border-primary-300"
                            )}
                        >
                            <cat.icon className="w-4 h-4" />
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Sort Options */}
                <div className="flex gap-2 mb-6">
                    {sortOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setSortBy(option.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-bold transition-all",
                                sortBy === option.id
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-500 hover:bg-slate-100"
                            )}
                        >
                            {option.name}
                        </button>
                    ))}
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                    {filteredQuestions.map(question => (
                        <QuestionCard key={question.id} question={question} />
                    ))}
                </div>

                {filteredQuestions.length === 0 && (
                    <div className="text-center py-16">
                        <MessageSquare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2">暂无问题</h3>
                        <p className="text-slate-500 mb-6">成为第一个提问的人</p>
                        <button
                            onClick={() => setShowAskModal(true)}
                            className="bg-primary-500 text-white px-6 py-3 rounded-2xl font-bold shadow-primary"
                        >
                            我要提问
                        </button>
                    </div>
                )}

                {/* AI Helper Tip */}
                <div className="mt-8 bg-primary-50 rounded-3xl p-6 border border-primary-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-500 rounded-2xl flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-primary-900">AI 智能问答</h3>
                            <p className="text-sm text-primary-700">问题太专业？试试 AI 助手，秒速解答你的疑惑</p>
                        </div>
                        <button className="bg-primary-500 text-white px-4 py-2 rounded-xl font-bold text-sm">
                            问 AI
                        </button>
                    </div>
                </div>
            </div>

            {/* Ask Question Modal */}
            {showAskModal && (
                <AskQuestionModal onClose={() => setShowAskModal(false)} />
            )}
        </div>
    );
}

// Question Card Component
function QuestionCard({ question }: { question: typeof mockQuestions[0] }) {
    return (
        <div className="bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-lg transition-all cursor-pointer">
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-slate-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-700">{question.author.name}</span>
                        <span className="text-xs text-slate-400">
                            {new Date(question.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                        {question.isAnswered && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-bold rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                已解决
                            </span>
                        )}
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-1">
                        {question.title}
                    </h3>
                    <p className="text-slate-500 text-sm line-clamp-2 mb-3">
                        {question.content}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {question.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                                #{tag}
                            </span>
                        ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                            <ThumbsUp className="w-4 h-4" />
                            {question.likes}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            {question.answers} 回答
                        </span>
                        <span>{question.views} 浏览</span>
                    </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
            </div>
        </div>
    );
}

// Ask Question Modal
function AskQuestionModal({ onClose }: { onClose: () => void }) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-900">提问</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">问题标题</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="简洁描述你的问题"
                            className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">问题分类</label>
                        <div className="flex flex-wrap gap-2">
                            {categories.slice(1).map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-sm font-bold transition-all",
                                        selectedCategory === cat.id
                                            ? "bg-primary-500 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">问题描述</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="详细描述你的问题，包括背景、已尝试的方案等..."
                            rows={5}
                            className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-primary-500 outline-none font-medium resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold"
                    >
                        取消
                    </button>
                    <button
                        disabled={!title || !content || !selectedCategory}
                        className={cn(
                            "flex-[2] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
                            title && content && selectedCategory
                                ? "bg-primary-500 text-white shadow-primary hover:bg-primary-600"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-5 h-5" />
                        发布问题
                    </button>
                </div>
            </div>
        </div>
    );
}
