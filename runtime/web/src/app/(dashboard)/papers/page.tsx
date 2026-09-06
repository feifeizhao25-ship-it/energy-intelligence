'use client';

import React, { useState } from 'react';
import {
    FileText,
    Search,
    Download,
    Bookmark,
    Share2,
    BookOpen,
    MessageSquare,
    Calendar,
    Users,
    Star,
    ChevronRight,
    ExternalLink,
    Filter,
    TrendingUp,
    Clock,
    Eye,
    MoreVertical,
    Sparkles,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// 旧版界面样式参考；页面数据只使用 /api/papers/search 的真实响应。
// 该常量不会进入任何展示或回退路径，待下一次页面拆分时物理移除。
const legacyPaperLayoutReference = [
    {
        id: '1',
        title: 'Perovskite Solar Cells: Recent Advances and Future Perspectives',
        authors: ['Zhang, L.', 'Wang, H.', 'Chen, Q.'],
        journal: 'Nature Energy',
        year: 2024,
        citations: 156,
        downloads: 2340,
        abstract: 'This review summarizes the recent progress in perovskite solar cells, focusing on efficiency improvements, stability enhancement, and scalable fabrication techniques.',
        keywords: ['perovskite', 'solar cell', 'efficiency', 'stability'],
        type: 'review',
        impactFactor: 45.2,
        openAccess: true
    },
    {
        id: '2',
        title: 'Machine Learning for Photovoltaic Power Prediction: A Comprehensive Survey',
        authors: ['Li, X.', 'Zhang, Y.', 'Liu, J.'],
        journal: 'Applied Energy',
        year: 2024,
        citations: 89,
        downloads: 1567,
        abstract: 'We present a comprehensive survey of machine learning approaches for photovoltaic power generation forecasting, including data preprocessing, model selection, and performance evaluation.',
        keywords: ['machine learning', 'photovoltaic', 'power prediction', 'forecasting'],
        type: 'survey',
        impactFactor: 11.4,
        openAccess: false
    },
    {
        id: '3',
        title: 'Hybrid Energy Storage Systems for Renewable Integration: Techno-Economic Analysis',
        authors: ['Wang, S.', 'Johnson, M.', 'Chen, L.'],
        journal: 'Energy Storage Materials',
        year: 2023,
        citations: 234,
        downloads: 3456,
        abstract: 'This study presents a comprehensive techno-economic analysis of hybrid energy storage systems combining batteries and supercapacitors for renewable energy integration.',
        keywords: ['energy storage', 'hybrid system', 'techno-economic', 'renewable integration'],
        type: 'research',
        impactFactor: 20.4,
        openAccess: true
    },
    {
        id: '4',
        title: 'Wind Turbine Blade Inspection Using UAV-based Thermal Imaging',
        authors: ['Liu, Q.', 'Brown, R.', 'Zhang, X.'],
        journal: 'Renewable Energy',
        year: 2024,
        citations: 67,
        downloads: 1234,
        abstract: 'We propose a novel UAV-based inspection system using thermal imaging for automated wind turbine blade damage detection and classification.',
        keywords: ['wind turbine', 'UAV', 'thermal imaging', 'inspection'],
        type: 'research',
        impactFactor: 8.4,
        openAccess: false
    },
    {
        id: '5',
        title: 'Carbon Neutrality Pathways: A Global Perspective',
        authors: ['Green, A.'],
        journal: 'Science',
        year: 2024,
        citations: 567,
        downloads: 8901,
        abstract: 'This paper analyzes global pathways to carbon neutrality by 2050, examining the role of renewable energy deployment and policy frameworks.',
        keywords: ['carbon neutrality', 'climate change', 'renewable energy', 'policy'],
        type: 'perspective',
        impactFactor: 63.7,
        openAccess: true
    }
];

const searchFilters = [
    { id: 'all', name: '全部' },
    { id: 'solar', name: '光伏' },
    { id: 'wind', name: '风电' },
    { id: 'storage', name: '储能' },
    { id: 'policy', name: '政策' },
    { id: 'grid', name: '电网' }
];

const paperTypes = [
    { id: 'research', name: '研究论文', color: 'blue' },
    { id: 'review', name: '综述', color: 'purple' },
    { id: 'survey', name: '调研', color: 'green' },
    { id: 'perspective', name: '观点', color: 'amber' }
];

export default function PapersPage() {
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [papers, setPapers] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [visibleCount, setVisibleCount] = useState(10);
    const [searchError, setSearchError] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [yearFrom, setYearFrom] = useState('');
    const [yearTo, setYearTo] = useState('');
    const [openAccess, setOpenAccess] = useState(false);
    const [unavailableSources, setUnavailableSources] = useState<string[]>([]);
    const [bookmarked, setBookmarked] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<string | null>(null);

    // 初始加载或搜索
    const handleSearch = async (query: string = searchQuery) => {
        if ((yearFrom && (!/^\d{4}$/.test(yearFrom) || Number(yearFrom) < 1800 || Number(yearFrom) > new Date().getFullYear())) ||
            (yearTo && (!/^\d{4}$/.test(yearTo) || Number(yearTo) < 1800 || Number(yearTo) > new Date().getFullYear())) ||
            (yearFrom && yearTo && Number(yearFrom) > Number(yearTo))) {
            setSearchError('请输入有效的起止年份，开始年份不能晚于结束年份。');
            return;
        }
        setIsSearching(true);
        setSearchError('');
        setPapers([]);
        setTotal(0);
        setVisibleCount(10);
        setUnavailableSources([]);
        try {
            const res = await fetch('/api/papers/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query || 'renewable energy',
                    options: { limit: 100, yearFrom: yearFrom ? Number(yearFrom) : undefined, yearTo: yearTo ? Number(yearTo) : undefined, openAccess }
                })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setPapers(data.data.papers);
                setTotal(data.data.papers.length);
                setUnavailableSources((data.data.providers || []).filter((p: any) => p.status === 'unavailable').map((p: any) => p.name));
            } else {
                setSearchError('学术数据源暂时不可用，请稍后重试。');
            }
        } catch (e) {
            setSearchError('检索连接失败，请检查网络后重试。');
        } finally {
            setIsSearching(false);
        }
    };

    // 保存文献到个人库
    const handleSavePaper = async (paper: any) => {
        setIsSaving(paper.id);
        try {
            const res = await fetch('/api/user/papers/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paper })
            });
            const data = await res.json();
            if (data.success) {
                setBookmarked(prev => [...prev, paper.id]);
                // 可以添加成功提示
            }
        } catch (e) {
            console.error('Save failed', e);
        } finally {
            setIsSaving(null);
        }
    };

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            research: 'bg-blue-100 text-blue-600',
            review: 'bg-purple-100 text-purple-600',
            survey: 'bg-green-100 text-green-600',
            perspective: 'bg-amber-100 text-amber-600'
        };
        return colors[type] || 'bg-slate-100 text-slate-600';
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 px-6 py-10 text-white">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <BookOpen className="w-8 h-8" />
                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">专业文献库</h1>
                        </div>
                        <Link href="/papers/library" className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/10 font-black text-sm">
                            <Bookmark className="w-4 h-4" /> 我的文献库
                        </Link>
                    </div>
                    <p className="text-indigo-100 mb-6">公开学术资源检索 · AI 辅助检索与摘要</p>

                    {/* Search */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSearch();
                        }}
                        className="relative group"
                    >
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-green-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="输入关键词，如钙钛矿电池稳定性、海上风电尾流效应"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-14 pr-32 py-5 rounded-[24px] text-slate-900 bg-white border-none shadow-2xl focus:ring-4 focus:ring-green-500/20 text-lg transition-all"
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '立即检索'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border-b border-slate-100 px-6 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto py-4">
                    {searchFilters.map((filter) => (
                        <button
                            key={filter.id}
                            onClick={() => {
                                setActiveFilter(filter.id);
                                handleSearch(filter.id === 'all' ? searchQuery : filter.name);
                            }}
                            className={cn(
                                "px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all",
                                activeFilter === filter.id
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {filter.name}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters} className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-full font-bold text-sm hover:bg-slate-50">
                            <Filter className="w-4 h-4" />
                            高级筛选
                        </button>
                    </div>
                </div>
            </div>

            {showFilters && <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-4 px-6 py-4">
                <label>开始年份 <input aria-label="开始年份" inputMode="numeric" value={yearFrom} onChange={e => setYearFrom(e.target.value)} className="w-24 border rounded p-2" /></label>
                <label>结束年份 <input aria-label="结束年份" inputMode="numeric" value={yearTo} onChange={e => setYearTo(e.target.value)} className="w-24 border rounded p-2" /></label>
                <label className="flex gap-2"><input type="checkbox" checked={openAccess} onChange={e => setOpenAccess(e.target.checked)} />仅显示有开放全文链接的论文</label>
                <button onClick={() => handleSearch()} disabled={isSearching} className="rounded bg-green-700 text-white px-4 py-2">应用筛选</button>
            </div>}
            {/* Stats */}
            <div className="px-6 py-6 bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-400" />
                            <span className="text-sm text-slate-600">本次返回 <strong className="text-slate-900">{total}</strong> 篇论文（最多 100 篇）</span>
                        </div>
                    </div>
                </div>
            </div>

            {searchError && <p role="alert" className="max-w-6xl mx-auto px-6 py-4 text-red-700">{searchError}</p>}
            {unavailableSources.length > 0 && <p role="status" className="max-w-6xl mx-auto px-6 py-4 text-amber-800">部分学术来源暂时不可用，本次仅展示可用来源的结果。</p>}
            {/* Papers List */}
            <div className="px-6 py-8">
                <div className="max-w-6xl mx-auto space-y-4">
                    {isSearching ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">正在检索全球文献库...</p>
                        </div>
                    ) : papers.length === 0 && !searchError ? <p className="py-8 text-slate-600">本次未检索到匹配论文，可以调整关键词后重试。</p> : papers.slice(0, visibleCount).map((paper) => (
                        <div
                            key={paper.id}
                            className="bg-white rounded-[32px] border border-slate-100 p-8 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-8">
                                <div className="flex-1 min-w-0">
                                    {/* Type & Year */}
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest", getTypeColor(paper.type || 'research'))}>
                                            {paper.venue || '学术论文'}
                                        </span>
                                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                                        <span className="text-sm font-bold text-slate-400">{paper.year ?? '年份未提供'}</span>
                                    </div>

                                    {/* Title */}
                                    <Link href={`/papers/${paper.id}`} className="text-xl font-black text-slate-900 mb-3 hover:text-green-600 transition-colors block leading-tight">
                                        {paper.title}
                                    </Link>

                                    {/* Authors */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <Users className="w-4 h-4 text-slate-300" />
                                        <span className="text-sm font-medium text-slate-500">{Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}</span>
                                    </div>

                                    {/* Abstract */}
                                    <p className="text-slate-500 text-sm line-clamp-2 mb-6 leading-relaxed">
                                        {paper.abstract}
                                    </p>

                                    {showFilters && <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-4 px-6 py-4">
                <label>开始年份 <input aria-label="开始年份" inputMode="numeric" value={yearFrom} onChange={e => setYearFrom(e.target.value)} className="w-24 border rounded p-2" /></label>
                <label>结束年份 <input aria-label="结束年份" inputMode="numeric" value={yearTo} onChange={e => setYearTo(e.target.value)} className="w-24 border rounded p-2" /></label>
                <label className="flex gap-2"><input type="checkbox" checked={openAccess} onChange={e => setOpenAccess(e.target.checked)} />仅显示有开放全文链接的论文</label>
                <button onClick={() => handleSearch()} disabled={isSearching} className="rounded bg-green-700 text-white px-4 py-2">应用筛选</button>
            </div>}
            {/* Stats */}
                                    <div className="flex items-center gap-8 text-sm">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <MessageSquare className="w-4 h-4" />
                                            <span className="font-bold">{paper.citationCount ?? '未提供'} 引用</span>
                                        </div>
                                        {paper.impactFactor && (
                                            <div className="flex items-center gap-2 text-amber-500">
                                                <Star className="w-4 h-4 fill-current" />
                                                <span className="font-black">IF: {paper.impactFactor}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-3 shrink-0">
                                    <button
                                        onClick={() => handleSavePaper(paper)}
                                        disabled={isSaving === paper.id || bookmarked.includes(paper.id)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm border",
                                            bookmarked.includes(paper.id)
                                                ? "bg-green-500 border-green-500 text-white"
                                                : "bg-white border-slate-100 text-slate-400 hover:text-green-600 hover:border-green-100"
                                        )}
                                    >
                                        {isSaving === paper.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bookmark className={cn("w-5 h-5", bookmarked.includes(paper.id) && "fill-current")} />}
                                    </button>
                                    <button className="w-12 h-12 bg-white border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center hover:text-blue-500 hover:border-blue-100 transition-all shadow-sm">
                                        <Share2 className="w-5 h-5" />
                                    </button>
                                    {paper.pdfUrl && (
                                        <a
                                            href={paper.pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-green-600 transition-all shadow-xl shadow-slate-200"
                                        >
                                            <Download className="w-5 h-5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Load More */}
            {papers.length > visibleCount && (
                <div className="px-6 py-8">
                    <div className="max-w-6xl mx-auto text-center">
                        <button
                            onClick={() => setVisibleCount(count => count + 10)}
                            className="px-10 py-5 bg-white border border-slate-100 text-slate-900 font-black rounded-3xl hover:bg-slate-50 transition-all shadow-xl shadow-slate-100/50"
                        >
                            查看更多专业文献
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
