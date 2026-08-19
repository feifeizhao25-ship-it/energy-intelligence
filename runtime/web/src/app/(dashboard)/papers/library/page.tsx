'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Folder,
    MoreVertical,
    Search,
    Plus,
    Filter,
    Tag,
    FileText,
    Upload,
    Loader2,
    Sparkles,
    BookOpen,
    ChevronRight,
    ArrowLeft,
    Trash2,
    Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function LibraryPage() {
    const [papers, setPapers] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchLibrary();
    }, [activeFolder]);

    const fetchLibrary = async () => {
        setIsLoading(true);
        try {
            const url = activeFolder ? `/api/user/papers?folderId=${activeFolder}` : '/api/user/papers';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setPapers(data.data.papers);
                setFolders(data.data.folders);
            }
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        if (activeFolder) formData.append('folderId', activeFolder);

        try {
            const res = await fetch('/api/papers/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                fetchLibrary();
            }
        } catch (e) {
            console.error('Upload failed', e);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const filteredPapers = papers.filter(p => {
        if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10 flex flex-col gap-8">
            {/* Top Navigation / Breadcrumbs */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/papers" className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-green-600 hover:border-green-100 transition-all shadow-sm">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">我的文献智库</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Personal Research Library</p>
                    </div>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-3.5 bg-green-500 text-white rounded-[20px] flex items-center gap-2 font-black text-sm hover:bg-green-600 transition-all shadow-xl shadow-green-100 group"
                >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />}
                    上传本地文献
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf"
                        className="hidden"
                    />
                </button>
            </div>

            <div className="flex-1 flex gap-8 min-h-0">
                {/* Sidebar */}
                <div className="w-72 flex-shrink-0 flex flex-col gap-6">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-4 overflow-hidden flex flex-col">
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">目录列表</div>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            <button
                                onClick={() => setActiveFolder(null)}
                                className={cn(
                                    "w-full px-4 py-3.5 rounded-2xl flex items-center justify-between transition-all group",
                                    !activeFolder ? "bg-green-500 text-white shadow-lg shadow-green-100" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className={cn("w-4 h-4", !activeFolder ? "text-white" : "text-slate-400 group-hover:text-green-500")} />
                                    <span className="font-bold text-sm">全部文献</span>
                                </div>
                                <span className={cn("text-xs font-black", !activeFolder ? "text-green-100" : "text-slate-300")}>{papers.length}</span>
                            </button>

                            {folders.map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={() => setActiveFolder(folder.id)}
                                    className={cn(
                                        "w-full px-4 py-3.5 rounded-2xl flex items-center justify-between transition-all group",
                                        activeFolder === folder.id ? "bg-green-500 text-white shadow-lg shadow-green-100" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Folder className={cn("w-4 h-4", activeFolder === folder.id ? "text-white" : "text-slate-400 group-hover:text-green-500")} />
                                        <span className="font-bold text-sm truncate max-w-[120px]">{folder.name}</span>
                                    </div>
                                    <span className={cn("text-xs font-black", activeFolder === folder.id ? "text-green-100" : "text-slate-300")}>{folder._count?.papers || 0}</span>
                                </button>
                            ))}
                        </div>

                        <button className="mt-4 mx-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 hover:border-green-200 hover:text-green-600 flex items-center justify-center gap-2 text-xs font-black transition-all">
                            <Plus className="w-4 h-4" /> 创建收纳夹
                        </button>
                    </div>

                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Tag className="w-4 h-4" /> 研究标签
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {['钙钛矿', '异质结', '长时储能', '平价上网', '氢能核心'].map(tag => (
                                <span key={tag} className="text-[10px] font-black px-3 py-1.5 bg-slate-50 text-slate-500 rounded-full hover:bg-green-500 hover:text-white cursor-pointer transition-all">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 gap-6">
                    {/* Toolbar */}
                    <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-xl group">
                            <input
                                type="text"
                                placeholder="在当前库中检索文献标题、作者或摘要..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-green-500 transition-all placeholder:text-slate-300"
                            />
                            <Search className="w-5 h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-green-500 transition-colors" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-100 hover:border-green-500 hover:text-green-600 text-xs font-black text-slate-500 transition-all">
                                <Filter className="w-4 h-4" /> 筛选排除
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white rounded-[40px] border border-slate-100 shadow-sm">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <p className="text-xs font-black uppercase tracking-widest">正在索引云端库...</p>
                            </div>
                        ) : filteredPapers.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-6 p-12">
                                <div className="w-24 h-24 rounded-[40px] bg-slate-50 flex items-center justify-center">
                                    <BookOpen className="w-12 h-12" />
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-lg font-black text-slate-900">文献库空空如也</h3>
                                    <p className="text-sm font-medium text-slate-400">您可以上传 PDF 或在学术检索页面收藏您感兴趣的文献。</p>
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {filteredPapers.map(paper => (
                                    <div key={paper.id} className="p-8 hover:bg-green-50/30 flex gap-6 group transition-all relative">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded uppercase tracking-widest">
                                                    {paper.journal || (paper.source === 'upload' ? 'LOCAL UPLOAD' : 'GLOBAL INDEX')}
                                                </span>
                                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                <span className="text-[10px] font-black text-green-600">{paper.year || paper.createdAt.split('T')[0]}</span>
                                            </div>
                                            <Link href={`/papers/${paper.paperId}`} className="text-lg font-black text-slate-900 hover:text-green-600 transition-colors block leading-snug">
                                                {paper.title}
                                            </Link>
                                            <div className="flex items-center gap-3 pt-2">
                                                {paper.status === 'completed' && (
                                                    <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 bg-green-500 text-white rounded-lg font-black uppercase tracking-widest">
                                                        <Sparkles className="w-3 h-3" /> AI 已解析
                                                    </div>
                                                )}
                                                {paper.tags?.map((tag: string) => (
                                                    <span key={tag} className="flex items-center gap-1 text-[10px] px-2 py-1 bg-slate-100 text-slate-500 rounded-lg font-black uppercase tracking-widest">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                                                <Link href={`/papers/${paper.paperId}`} title="AI 阅读助手" className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-green-600 hover:border-green-100 transition-all">
                                                    <Sparkles className="w-5 h-5" />
                                                </Link>
                                                <button title="分享文件" className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-100 transition-all">
                                                    <Share2 className="w-5 h-5" />
                                                </button>
                                                <button title="移除文献" className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="w-px h-8 bg-slate-100 mx-2" />
                                            <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-slate-900 transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
