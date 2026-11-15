'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Node { id: string; title: string; year: number | null; source: string; licence: string }
interface Edge { from: string; to: string }

export default function GraphPage() {
    const [notice, setNotice] = useState('');
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [error, setError] = useState('');
    useEffect(() => {
        fetch('/api/papers/graph').then(async (response) => {
            const body = await response.json();
            if (!response.ok) {
                setError(body.error || '图谱暂时无法读取');
                return;
            }
            setNodes(body.data?.nodes || []);
            setEdges(body.data?.edges || []);
            setNotice(body.data?.notice || '');
        }).catch(() => setError('图谱暂时无法读取'));
    }, []);
    return <div className="mx-auto max-w-4xl space-y-4 text-slate-900">
        <h1 className="text-2xl font-black">文献图谱</h1>
        <p className="text-sm leading-6 text-slate-600">节点来自已入库语料。没有可以互相对上的标识时，不画模拟连线。</p>
        <Link href="/papers" className="text-sm font-bold text-emerald-700">返回文献检索</Link>
        {error && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        {notice && <p className="text-sm text-slate-700">{notice}</p>}
        <ul className="space-y-2">
            {nodes.map((node) => <li key={node.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="font-bold">{node.title}</div>
                <div className="text-slate-500">{node.year || '年份未记录'} · {node.source} · {node.licence || '许可见语料说明'}</div>
            </li>)}
        </ul>
        {edges.length > 0 && <p className="text-sm">可核验连线 {edges.length} 条。</p>}
    </div>;
}
