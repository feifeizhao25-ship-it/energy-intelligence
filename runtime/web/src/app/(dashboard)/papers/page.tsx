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
                // 401/429 等带有明确中文原因（未登录、今日次数已用完），优先展示
                setSearchError(typeof data?.message === 'string' && data.message ? data.message : '学术数据源暂时不可用，请稍后重试。');
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
        <div className="min-w-0 pb-8">
            <div className="ei-page-head px-4 py-8 sm:px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-3">
                            <BookOpen className="w-8 h-8" />
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">专业文献库</h1>
                        </div>
                        <Link href="/papers/library" className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl transition-all border border-white/10 font-black text-sm">
                            <Bookmark className="w-4 h-4" /> 我的文献库
                        </Link>
                    </div>
                    <p className="mb-6 text-sm">公开学术资源检索。摘要只复述已返回的文献信息。</p>

                    {/* Search */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSearch();
                        }}
                        className="flex flex-col gap-2 sm:relative sm:block"
                    >
                        <Search className="pointer-events-none absolute left-5 top-5 hidden h-6 w-6 text-slate-400 sm:block" />
                        <input
                            type="text"
                            placeholder="输入关键词，如钙钛矿电池稳定性、海上风电尾流效应"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-2xl border border-white/20 bg-white px-4 py-4 text-base text-slate-900 shadow-lg sm:py-5 sm:pl-14 sm:pr-32 sm:text-lg"
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="rounded-xl bg-[var(--teal)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:absolute sm:right-3 sm:top-1/2 sm:-translate-y-1/2"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '立即检索'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Filters */}
            <div className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6">
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

            {searchError && (
                <div role="alert" className="ei-error mx-auto mt-4 max-w-6xl">
                    <p>{searchError}</p>
                    <button type="button" className="mt-3 rounded-xl bg-[var(--navy)] px-3 py-2 text-sm text-white" onClick={() => handleSearch()}>重试</button>
                </div>
            )}
            {unavailableSources.length > 0 && <p role="status" className="max-w-6xl mx-auto px-6 py-4 text-amber-800">部分学术来源暂时不可用，本次仅展示可用来源的结果。</p>}
            {/* Papers List */}
            <div className="px-6 py-8">
                <div className="max-w-6xl mx-auto space-y-4">
                    {isSearching ? (
                        <div data-testid="loading-skeleton" className="space-y-3 py-6" aria-busy="true">
                            <div className="ei-skeleton h-28 w-full" />
                            <div className="ei-skeleton h-28 w-full" />
                            <p className="text-sm text-[var(--ink-soft)]">正在检索已入库文献...</p>
                        </div>
                    ) : papers.length === 0 && !searchError ? <p className="ei-empty py-8 text-[var(--ink-soft)]">本次未检索到匹配论文，可以调整关键词后重试。</p> : papers.slice(0, visibleCount).map((paper) => (
                        <div
                            key={paper.id}
                            className="ei-panel transition-shadow hover:shadow-md"
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
                                        {paper.titleZh || paper.title}
                                    </Link>
                                    {paper.titleZh && paper.titleZh !== paper.title ? (
                                        <p className="mb-3 text-sm text-slate-500" data-testid="paper-original-title">
                                            <span className="mr-2 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">译名{paper.titleZhStatus ? `（${paper.titleZhStatus}）` : ''}</span>
                                            原文标题：{paper.title}
                                            {paper.sourceUrl ? <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-[var(--teal)] underline">查看原文</a> : null}
                                        </p>
                                    ) : null}

                                    {/* Authors */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <Users className="w-4 h-4 text-slate-300" />
                                        <span className="text-sm font-medium text-slate-500">{Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}</span>
                                    </div>

                                    {/* Abstract */}
                                    <p className="text-slate-500 text-sm line-clamp-2 mb-6 leading-relaxed">
                                        {paper.abstract}
                                    </p>
                                    {paper.abstract && !/[\u4e00-\u9fff]/.test(paper.abstract) ? <p className="-mt-4 mb-4 text-xs text-slate-400">摘要为原文语言，暂无中文译文。</p> : null}
                                    {paper.licenceNote ? <p className="mb-4 text-sm text-slate-500">署名：{paper.licenceNote}</p> : null}

                                    <div className="flex items-center gap-8 text-sm">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <MessageSquare className="w-4 h-4" />
                                            <span className="font-bold">{paper.citationCount ?? '未提供'} 引用</span>
                                        </div>
                                        {paper.impactFactor && (
                                            <div className="flex items-center gap-2 text-amber-500">
                                                <Star className="w-4 h-4 fill-current" />
                                                <span className="font-black">影响因子 {paper.impactFactor}</span>
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
