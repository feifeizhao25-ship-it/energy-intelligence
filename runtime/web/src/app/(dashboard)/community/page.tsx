'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Plus, RefreshCw } from 'lucide-react';

type Question = {
    id: string;
    title: string;
    content: string;
    category: string;
    createdAt: string;
    answerCount: number;
    author: { name: string };
};

export default function CommunityPage() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('technology');
    const [submitting, setSubmitting] = useState(false);

    const loadQuestions = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch('/api/community/questions', { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || '社区内容加载失败');
            setQuestions(Array.isArray(payload.questions) ? payload.questions : []);
        } catch (cause) {
            setQuestions([]);
            setError(cause instanceof Error ? cause.message : '社区内容加载失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadQuestions();
    }, [loadQuestions]);

    async function submitQuestion(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const response = await fetch('/api/community/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, category }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || '问题发布失败');
            setTitle('');
            setContent('');
            setShowForm(false);
            await loadQuestions();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : '问题发布失败');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 px-6 py-10">
            <div className="mx-auto max-w-4xl">
                <header className="mb-8 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900">问答社区</h1>
                        <p className="mt-2 text-slate-500">仅展示已由真实用户提交并持久化保存的内容</p>
                    </div>
                    <button onClick={() => setShowForm(value => !value)} className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white">
                        <Plus className="h-5 w-5" />我要提问
                    </button>
                </header>

                {showForm && (
                    <form onSubmit={submitQuestion} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
                        <input required value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="问题标题" className="w-full rounded-xl border p-3" />
                        <textarea required value={content} onChange={event => setContent(event.target.value)} maxLength={3000} rows={5} placeholder="请描述背景和已经尝试的方法" className="w-full rounded-xl border p-3" />
                        <select value={category} onChange={event => setCategory(event.target.value)} className="rounded-xl border p-3">
                            <option value="technology">技术讨论</option><option value="installation">安装咨询</option><option value="maintenance">运维问题</option><option value="policy">政策问题</option>
                        </select>
                        <button disabled={submitting} className="ml-3 rounded-xl bg-green-600 px-5 py-3 font-bold text-white disabled:opacity-50">{submitting ? '正在发布…' : '发布问题'}</button>
                    </form>
                )}

                {error && (
                    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                        <p className="font-bold">社区暂不可用</p><p className="mt-1 text-sm">{error}</p>
                        <button onClick={() => void loadQuestions()} className="mt-3 flex items-center gap-2 text-sm font-bold"><RefreshCw className="h-4 w-4" />重新加载</button>
                    </section>
                )}

                {loading ? <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-green-600" /> : questions.length ? (
                    <div className="space-y-4">{questions.map(question => (
                        <article key={question.id} className="rounded-2xl border border-slate-100 bg-white p-6">
                            <h2 className="text-lg font-bold text-slate-900">{question.title}</h2>
                            <p className="mt-2 line-clamp-3 text-sm text-slate-600">{question.content}</p>
                            <p className="mt-4 text-xs text-slate-400">{question.author.name} · {new Date(question.createdAt).toLocaleDateString('zh-CN')} · {question.answerCount} 个回答</p>
                        </article>
                    ))}</div>
                ) : !error && (
                    <div className="py-20 text-center"><MessageSquare className="mx-auto h-14 w-14 text-slate-200" /><p className="mt-4 font-bold text-slate-700">暂无真实问题</p></div>
                )}
            </div>
        </main>
    );
}
