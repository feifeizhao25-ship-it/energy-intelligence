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

// Mock papers data
const mockPapers = [
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
    const [papers, setPapers] = useState<any[]>(mockPapers);
    const [total, setTotal] = useState(5);
    const [bookmarked, setBookmarked] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<string | null>(null);

    // 初始加载或搜索
    const handleSearch = async (query: string = searchQuery) => {
        setIsSearching(true);
        try {
            const res = await fetch('/api/papers/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query || 'renewable energy',
                    options: { limit: 10 }
                })
            });
            const data = await res.json();
            if (data.success && data.data) {
                setPapers(data.data.papers);
                setTotal(data.data.total);
            }
        } catch (e) {
            console.error('Search failed', e);
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
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <BookOpen className="w-8 h-8" />
                            <h1 className="text-3xl font-black tracking-tight">专业文献库</h1>
                        </div>
                        <Link href="/papers/library" className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/10 font-black text-sm">
                            <Bookmark className="w-4 h-4" /> 我的文献库
                        </Link>
                    </div>
                    <p className="text-indigo-100 mb-6">2.1 亿+ 全球学术资源 · AI 辅助检索与摘要</p>

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
                            placeholder="输入关键词，如 '钙钛矿电池稳定性' 或 'Offshore wind farm wake effect'..."
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
                                if (filter.id !== 'all') handleSearch(filter.name);
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
                        <button className="flex items-center gap-2 px-5 py-2 bg-white border border-slate-200 rounded-full font-bold text-sm hover:bg-slate-50">
                            <Filter className="w-4 h-4" />
                            高级筛选
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="px-6 py-6 bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-400" />
                            <span className="text-sm text-slate-600">找到 <strong className="text-slate-900">{total}</strong> 篇相关论文</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Papers List */}
            <div className="px-6 py-8">
                <div className="max-w-6xl mx-auto space-y-4">
                    {isSearching ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">正在检索全球文献库...</p>
                        </div>
                    ) : papers.map((paper) => (
                        <div
                            key={paper.id}
                            className="bg-white rounded-[32px] border border-slate-100 p-8 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group"
                        >
                            <div className="flex items-start justify-between gap-8">
                                <div className="flex-1 min-w-0">
                                    {/* Type & Year */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest", getTypeColor(paper.type || 'research'))}>
                                            {paper.venue || 'SCIENTIFIC PAPER'}
                                        </span>
                                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                                        <span className="text-sm font-bold text-slate-400">{paper.year}</span>
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

                                    {/* Stats */}
                                    <div className="flex items-center gap-8 text-sm">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <MessageSquare className="w-4 h-4" />
                                            <span className="font-bold">{paper.citationCount} 引用</span>
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
            {total > papers.length && (
                <div className="px-6 py-8">
                    <div className="max-w-6xl mx-auto text-center">
                        <button
                            onClick={() => {/* Implement pagination */ }}
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
