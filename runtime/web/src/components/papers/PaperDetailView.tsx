'use client';

import { useState, useEffect } from 'react';
import { Paper } from '@/types';
import { PdfStatus } from '@/lib/papers/pdf';
import {
    BookOpen,
    Share2,
    Star,
    Download,
    Globe,
    FileText,
    ChevronRight,
    Sparkles,
    Languages,
    List,
    ArrowLeft,
    Calendar,
    Users,
    Trophy,
    Zap,
    ChevronDown,
    ShieldCheck,
    Send,
    Loader2,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface PaperDetailViewProps {
    paper: Paper;
    pdfStatus: PdfStatus;
}

export default function PaperDetailView({ paper, pdfStatus }: PaperDetailViewProps) {
    const [activeTab, setActiveTab] = useState<'abstract' | 'ai' | 'data' | 'chat' | 'translate'>('abstract');
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [keyData, setKeyData] = useState<any[] | null>(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [translatedAbstract, setTranslatedAbstract] = useState<string | null>(null);
    const [fullTranslation, setFullTranslation] = useState<{ en: string, zh: string, section: string }[] | null>(null);
    const [recommendations, setRecommendations] = useState<Paper[]>([]);
    const [isDualMode, setIsDualMode] = useState(false);

    // Chat & Indexing State
    const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [indexingStatus, setIndexingStatus] = useState<'idle' | 'loading' | 'completed' | 'error'>('idle');
    const [indexingProgress, setIndexingProgress] = useState(0);

    useEffect(() => {
        // Load recommendations lazily
        fetch(`/api/papers/recommendations?id=${paper.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) setRecommendations(data.data);
            })
            .catch(err => console.error(err));
    }, [paper.id]);

    const handleAiSummary = async () => {
        if (aiSummary) return;
        setLoadingAi(true);
        try {
            const res = await fetch('/api/papers/ai', {
                method: 'POST',
                body: JSON.stringify({ action: 'summary', text: paper.abstract, title: paper.title })
            });
            const data = await res.json();
            if (data.success) setAiSummary(data.data);
        } catch (e) { console.error(e); }
        setLoadingAi(false);
    };

    const handleFullTranslation = async () => {
        if (fullTranslation) return;
        setLoadingAi(true);
        try {
            const res = await fetch('/api/papers/ai', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'full_translation',
                    text: `Title: ${paper.title}\n\nAbstract: ${paper.abstract}`
                })
            });
            const data = await res.json();
            if (data.success) {
                setFullTranslation(data.data);
            }
        } catch (e) {
            console.error(e);
            setFullTranslation([{ section: "Error", en: "Failed to load translation.", zh: "翻译服务暂时不可用，请稍后重试。" }]);
        }
        setLoadingAi(false);
    };

    const handleKeyData = async () => {
        if (keyData) return;
        setLoadingAi(true);
        try {
            const res = await fetch('/api/papers/ai', {
                method: 'POST',
                body: JSON.stringify({ action: 'key_data', text: paper.abstract + (paper.tldr || "") })
            });
            const data = await res.json();
            if (data.success) setKeyData(data.data);
        } catch (e) { console.error(e); }
        setLoadingAi(false);
    };

    const handleTranslate = async () => {
        if (translatedAbstract) return;
        try {
            const res = await fetch('/api/papers/ai', {
                method: 'POST',
                body: JSON.stringify({ action: 'translate', text: paper.abstract })
            });
            const data = await res.json();
            if (data.success) setTranslatedAbstract(data.data);
        } catch (e) { console.error(e); }
    };

    const handleTriggerIndex = async () => {
        if (indexingStatus === 'completed' || !pdfStatus.url) return;
        setIndexingStatus('loading');
        setIndexingProgress(20);
        try {
            const res = await fetch('/api/papers/index', {
                method: 'POST',
                body: JSON.stringify({ paperId: paper.id, pdfUrl: pdfStatus.url, title: paper.title })
            });
            const data = await res.json();
            if (data.success) {
                setIndexingStatus('completed');
                setIndexingProgress(100);
                if (messages.length === 0) {
                    setMessages([{ role: 'assistant', content: `你好！我已经读完了这篇论文《${paper.title}》，你可以问我关于它的任何问题，比如：“这篇论文的主要发现是什么？”或“文中提到的效率数据是多少？”` }]);
                }
            } else {
                setIndexingStatus('error');
            }
        } catch (e) {
            setIndexingStatus('error');
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isSending || indexingStatus !== 'completed') return;

        const userMsg = { role: 'user', content: chatInput };
        setMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setIsSending(true);

        try {
            const response = await fetch('/api/papers/chat', {
                method: 'POST',
                body: JSON.stringify({ paperId: paper.id, messages: [...messages, userMsg] })
            });

            if (!response.ok) throw new Error('Chat failed');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader');

            let assistantContent = '';
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.type === 'content') {
                                assistantContent += parsed.data;
                                setMessages(prev => {
                                    const latest = [...prev];
                                    latest[latest.length - 1].content = assistantContent;
                                    return latest;
                                });
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，对话服务暂时不可用。' }]);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Header / Breadcrumb */}
            <div className="flex items-center justify-between">
                <Link href="/papers" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-green-600 transition-all shadow-sm font-bold text-sm">
                    <ArrowLeft className="w-4 h-4" /> 返回文献库
                </Link>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setActiveTab('translate');
                            setIsDualMode(true);
                            handleFullTranslation();
                        }}
                        className="px-6 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm font-black text-xs flex items-center gap-2"
                    >
                        <Languages className="w-4 h-4" /> 进入译文对照模式
                    </button>
                    <button className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-amber-500 transition-all shadow-sm">
                        <Star className="w-5 h-5" />
                    </button>
                    <button className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all shadow-sm">
                        <Share2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* Meta Panel */}
                {!isDualMode && (
                    <div className="lg:col-span-1 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                            <div>
                                <span className="text-[10px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-lg uppercase tracking-widest mb-4 inline-block">
                                    {paper.venue || 'ACADEMIC ARTICLE'}
                                </span>
                                <h1 className="text-2xl font-black text-slate-900 leading-tight mb-6">{paper.title}</h1>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">主要作者</div>
                                        <div className="text-sm font-bold text-slate-700 leading-relaxed">
                                            {paper.authors.join(', ')}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">发表年份</div>
                                            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                                <Calendar className="w-4 h-4 text-green-500" /> {paper.year ?? '年份未提供'}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">引用次数</div>
                                            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                                <Zap className="w-4 h-4 text-amber-500" /> {paper.citationCount ?? '未提供'}
                                            </div>
                                        </div>
                                    </div>

                                    {paper.doi && (
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">数字对象标识符 (DOI)</div>
                                            <a href={`https://doi.org/${paper.doi}`} target="_blank" className="text-xs font-bold text-green-600 hover:underline break-all block">
                                                {paper.doi}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-50 space-y-3">
                                {pdfStatus.url ? (
                                    <a
                                        href={pdfStatus.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl hover:bg-slate-800 transition-all font-black text-sm shadow-xl shadow-slate-100 group"
                                    >
                                        <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                                        获取完整 PDF
                                        {pdfStatus.isOa && <span className="ml-1 text-[10px] text-green-400">FREE</span>}
                                    </a>
                                ) : (
                                    <button disabled className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-300 py-4 rounded-2xl font-black text-sm cursor-not-allowed">
                                        <Download className="w-5 h-5" />
                                        暂无免费全文
                                    </button>
                                )}
                                <div className="text-center">
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">来源: Semantic Scholar</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                                <List className="w-4 h-4" /> 相关文献推荐
                            </h3>
                            <div className="space-y-6">
                                {(Array.isArray(recommendations) ? recommendations : []).slice(0, 3).map(rec => (
                                    <Link key={rec.id} href={`/papers/${rec.id}`} className="block group space-y-2">
                                        <div className="text-sm font-bold text-slate-700 group-hover:text-green-600 transition-colors leading-snug">
                                            {rec.title}
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-black text-slate-400">
                                            <span>{rec.year ?? '年份未提供'}</span>
                                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                            <span className="text-green-600">{rec.citationCount ?? '未提供'} 引用</span>
                                        </div>
                                    </Link>
                                ))}
                                {(!recommendations || (Array.isArray(recommendations) && recommendations.length === 0)) && <div className="text-xs font-bold text-slate-300 animate-pulse">正在生成匹配项...</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className={cn("space-y-8", isDualMode ? "lg:col-span-4" : "lg:col-span-3")}>
                    <div className={cn(
                        "bg-white rounded-[48px] border border-slate-100 shadow-sm flex flex-col overflow-hidden transition-all duration-700",
                        isDualMode ? "min-h-[85vh]" : "min-h-[700px]"
                    )}>
                        {/* Tabs Navigation */}
                        <div className="flex items-center justify-between bg-slate-50/50 p-2">
                            <div className="flex flex-1 gap-1">
                                {[
                                    { id: 'abstract', label: '研究摘要', icon: FileText },
                                    { id: 'translate', label: '全文精译', icon: Languages },
                                    { id: 'ai', label: 'AI 深度速读', icon: Sparkles },
                                    { id: 'data', label: '核心参数', icon: List },
                                    { id: 'chat', label: 'AI 文献对话', icon: BookOpen }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as any);
                                            if (tab.id === 'ai') handleAiSummary();
                                            if (tab.id === 'data') handleKeyData();
                                            if (tab.id === 'translate') handleFullTranslation();
                                            if (tab.id !== 'translate') setIsDualMode(false);
                                        }}
                                        className={cn(
                                            "px-6 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-3xl transition-all",
                                            activeTab === tab.id
                                                ? "bg-white text-green-600 shadow-sm shadow-green-50"
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                            {activeTab === 'translate' && (
                                <button
                                    onClick={() => setIsDualMode(!isDualMode)}
                                    className="px-4 py-2 mr-4 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                                >
                                    {isDualMode ? '退出对照' : '开启对照'}
                                </button>
                            )}
                        </div>

                        {/* Content Container */}
                        <div className="p-10 flex-1 relative overflow-hidden">
                            {activeTab === 'abstract' && (
                                <div className="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center group">
                                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                            <div className="w-1 h-6 bg-green-500 rounded-full"></div>
                                            Abstract 原文
                                        </h3>
                                        <button
                                            onClick={handleTranslate}
                                            className="px-4 py-2 bg-green-50 text-green-700 text-xs font-black rounded-xl hover:bg-green-100 transition-all flex items-center gap-2"
                                        >
                                            <Languages className="w-4 h-4" />
                                            {translatedAbstract ? '显示原文' : '一键精译'}
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <div className="absolute -left-6 top-0 bottom-0 w-px bg-slate-100"></div>
                                        <p className="text-slate-600 font-medium leading-relaxed italic pr-10">
                                            &quot;{(paper.abstract && !paper.abstract.includes('由于 Semantic Scholar API')) ? paper.abstract : "Abstract preview is available in the full PDF document."}&quot;
                                        </p>
                                    </div>

                                    {translatedAbstract && (
                                        <div className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 relative group animate-in slide-in-from-top-4 duration-500">
                                            <div className="absolute -top-3 left-8 px-4 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-green-600 uppercase tracking-widest">
                                                中文精解
                                            </div>
                                            <p className="text-slate-900 font-bold leading-relaxed text-lg">
                                                {translatedAbstract}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'translate' && (
                                <div className="h-full">
                                    {!fullTranslation ? (
                                        <div className="flex flex-col items-center justify-center py-40 text-center space-y-6">
                                            <div className="w-24 h-24 rounded-[40px] bg-indigo-50 flex items-center justify-center">
                                                <Languages className="w-12 h-12 text-indigo-500 animate-pulse" />
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="text-xl font-black text-slate-900">学术级全文翻译引擎</h4>
                                                <p className="text-sm font-medium text-slate-400">正在进行逐段语义对齐与术语标准化...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            "space-y-12 animate-in fade-in duration-700",
                                            isDualMode && "max-w-none"
                                        )}>
                                            {fullTranslation.map((item, i) => (
                                                <div key={i} className={cn(
                                                    "flex flex-col gap-6",
                                                    isDualMode ? "lg:flex-row lg:gap-12" : ""
                                                )}>
                                                    {/* Section Header */}
                                                    {item.section && !isDualMode && (
                                                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <div className="w-4 h-px bg-indigo-200"></div>
                                                            {item.section}
                                                        </div>
                                                    )}

                                                    {/* Dual Pane Layout */}
                                                    <div className={cn("flex-1 space-y-3", isDualMode && "lg:w-1/2")}>
                                                        {isDualMode && <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">ORIGINAL TEXT / {item.section}</div>}
                                                        <p className="text-slate-500 font-medium leading-relaxed prose prose-slate">
                                                            {item.en}
                                                        </p>
                                                    </div>

                                                    <div className={cn("flex-1 space-y-3", isDualMode && "lg:w-1/2 lg:pl-12 lg:border-l lg:border-slate-100")}>
                                                        {isDualMode && <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2">专家译文</div>}
                                                        <p className="text-slate-900 font-black leading-relaxed text-lg">
                                                            {item.zh}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'ai' && (
                                <div className="space-y-6 max-w-4xl">
                                    {!aiSummary ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                                            <div className="w-20 h-20 rounded-[32px] bg-green-50 flex items-center justify-center">
                                                <Sparkles className="w-10 h-10 text-green-500 animate-pulse" />
                                            </div>
                                            <div className="space-y-2">
                                                <h4 className="text-lg font-black text-slate-900">AI 正在量子化阅读</h4>
                                                <p className="text-sm font-medium text-slate-400">正在生成核心发现、方法论与行业影响评估...</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-8 animate-in fade-in duration-700">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-green-500 p-2 rounded-xl shadow-lg shadow-green-100">
                                                    <Sparkles className="w-5 h-5 text-white" />
                                                </div>
                                                <h3 className="text-xl font-black text-slate-900">研究核心深度透视</h3>
                                            </div>
                                            <div className="text-slate-700 font-medium leading-relaxed space-y-6 text-lg prose-green max-w-none">
                                                {aiSummary.split('\n').filter(line => line.trim()).map((line, i) => {
                                                    if (line.startsWith('###')) {
                                                        return <h4 key={i} className="text-xl font-black text-slate-900 mt-10 mb-4 flex items-center gap-2">
                                                            <div className="w-1.5 h-6 bg-green-500 rounded-full"></div>
                                                            {line.replace('###', '').trim()}
                                                        </h4>
                                                    }
                                                    return <p key={i}>{line}</p>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'data' && (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-100">
                                            <Zap className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900">核心学术/技术参数提取</h3>
                                    </div>

                                    {!keyData ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Ready for &quot;Deep Dive&quot; Analysis</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {keyData.map((item, i) => (
                                                <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-50 transition-all group">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 group-hover:text-amber-500 transition-colors">{item.label}</div>
                                                    <div className="text-2xl font-black text-slate-900 mb-4">{item.value}</div>
                                                    <div className="text-xs font-medium text-slate-500 leading-relaxed line-clamp-3 bg-slate-50 p-3 rounded-xl" title={item.context}>
                                                        {item.context}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'chat' && (
                                <div className="flex flex-col h-[600px] bg-slate-50/30 rounded-[40px] border border-slate-100 p-6">
                                    {indexingStatus !== 'completed' ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8">
                                            <div className="relative">
                                                <div className="absolute -inset-4 bg-green-500/20 rounded-full blur-xl animate-pulse"></div>
                                                <div className="relative w-20 h-20 rounded-[32px] bg-white shadow-xl flex items-center justify-center">
                                                    <Sparkles className={cn("w-10 h-10 text-green-500", indexingStatus === 'loading' && "animate-spin")} />
                                                </div>
                                            </div>
                                            <div className="space-y-4 max-w-sm">
                                                <h4 className="text-2xl font-black text-slate-900">
                                                    {indexingStatus === 'idle' ? '开启深度对话模式' :
                                                        indexingStatus === 'loading' ? '正在向量化全文索引' :
                                                            indexingStatus === 'error' ? '索引构建失败' : ''}
                                                </h4>
                                                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                                                    {indexingStatus === 'idle' ? 'AI 将深度扫描全文（包含图表注脚），让您可以针对研究细节、公式或实验背景直接提问。' :
                                                        indexingStatus === 'loading' ? '我们正在构建文中的语义知识图谱，这通常需要 10-20 秒。' :
                                                            '由于版权保护或文档无法读取，AI 暂无法提供深度对话服务。'}
                                                </p>
                                            </div>
                                            {indexingStatus === 'idle' && (
                                                <button
                                                    onClick={handleTriggerIndex}
                                                    disabled={!pdfStatus.url}
                                                    className="bg-green-500 text-white px-10 py-4 rounded-[22px] font-black text-sm hover:bg-green-600 disabled:opacity-50 transition-all flex items-center gap-2 shadow-xl shadow-green-100 group"
                                                >
                                                    立即构建索引 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full">
                                            <div className="flex-1 overflow-y-auto space-y-6 pb-6 px-2 custom-scrollbar">
                                                {messages.map((msg, i) => (
                                                    <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "")}>
                                                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", msg.role === 'user' ? "bg-slate-900" : "bg-green-500")}>
                                                            {msg.role === 'user' ? <Users className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
                                                        </div>
                                                        <div className={cn(
                                                            "max-w-[80%] px-6 py-4 rounded-[24px] text-sm font-medium leading-relaxed shadow-sm",
                                                            msg.role === 'user' ? "bg-slate-900 text-white" : "bg-white text-slate-700 border border-slate-100"
                                                        )}>
                                                            {msg.content || (isSending && i === messages.length - 1 ? (
                                                                <div className="flex gap-1.5 py-1">
                                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"></div>
                                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                                                </div>
                                                            ) : "")}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="pt-6 border-t border-slate-100">
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        value={chatInput}
                                                        onChange={e => setChatInput(e.target.value)}
                                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                                        placeholder="针对论文核心发现或实验背景提问..."
                                                        className="w-full pl-6 pr-16 py-5 rounded-[24px] bg-white border border-slate-100 focus:ring-4 focus:ring-green-500/10 focus:border-green-500/50 shadow-sm transition-all text-sm font-bold"
                                                    />
                                                    <button
                                                        onClick={handleSendMessage}
                                                        disabled={isSending || !chatInput.trim()}
                                                        className="absolute right-3 top-3 bottom-3 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:bg-green-600 disabled:opacity-20 transition-all shadow-lg"
                                                    >
                                                        <Send className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
