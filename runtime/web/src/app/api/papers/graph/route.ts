import { NextRequest, NextResponse } from 'next/server';

/**
 * 知识图谱 API
 * 基于文献引用关系生成知识图谱
 */

interface GraphNode {
    id: string;
    label: string;
    type: 'paper' | 'author' | 'topic';
    citations?: number;
    year?: number;
}

interface GraphEdge {
    source: string;
    target: string;
    type: 'cites' | 'authored_by' | 'related_to';
    weight?: number;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const paperId = url.searchParams.get('paperId');
    const depth = parseInt(url.searchParams.get('depth') || '2');
    const type = url.searchParams.get('type') || 'citation'; // citation | collaboration | topic

    // 模拟知识图谱数据
    const generateGraph = (paperId: string | null, depth: number, type: string) => {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        if (type === 'citation') {
            // 引用网络
            nodes.push(
                { id: 'paper-1', label: 'Machine Learning for Solar Energy Prediction', type: 'paper', citations: 245, year: 2023 },
                { id: 'paper-2', label: 'Deep Learning in Renewable Energy', type: 'paper', citations: 189, year: 2022 },
                { id: 'paper-3', label: 'Neural Networks for Wind Power Forecasting', type: 'paper', citations: 156, year: 2023 },
                { id: 'paper-4', label: 'AI Applications in Energy Systems', type: 'paper', citations: 312, year: 2021 },
                { id: 'paper-5', label: 'Optimization Techniques for Solar Farms', type: 'paper', citations: 98, year: 2024 }
            );

            edges.push(
                { source: 'paper-1', target: 'paper-2', type: 'cites', weight: 3 },
                { source: 'paper-1', target: 'paper-4', type: 'cites', weight: 5 },
                { source: 'paper-2', target: 'paper-4', type: 'cites', weight: 4 },
                { source: 'paper-3', target: 'paper-2', type: 'cites', weight: 2 },
                { source: 'paper-3', target: 'paper-4', type: 'cites', weight: 3 },
                { source: 'paper-5', target: 'paper-1', type: 'cites', weight: 2 }
            );
        } else if (type === 'collaboration') {
            // 作者合作网络
            nodes.push(
                { id: 'author-1', label: 'Zhang Wei', type: 'author' },
                { id: 'author-2', label: 'Li Ming', type: 'author' },
                { id: 'author-3', label: 'Wang Fang', type: 'author' },
                { id: 'author-4', label: 'Chen Hao', type: 'author' },
                { id: 'paper-1', label: 'Solar Energy Prediction', type: 'paper', year: 2023 },
                { id: 'paper-2', label: 'Wind Power Optimization', type: 'paper', year: 2023 }
            );

            edges.push(
                { source: 'author-1', target: 'paper-1', type: 'authored_by' },
                { source: 'author-2', target: 'paper-1', type: 'authored_by' },
                { source: 'author-2', target: 'paper-2', type: 'authored_by' },
                { source: 'author-3', target: 'paper-2', type: 'authored_by' },
                { source: 'author-4', target: 'paper-1', type: 'authored_by' }
            );
        } else {
            // 主题关系网络
            nodes.push(
                { id: 'topic-1', label: 'Machine Learning', type: 'topic' },
                { id: 'topic-2', label: 'Solar Energy', type: 'topic' },
                { id: 'topic-3', label: 'Wind Power', type: 'topic' },
                { id: 'topic-4', label: 'Energy Storage', type: 'topic' },
                { id: 'topic-5', label: 'Optimization', type: 'topic' }
            );

            edges.push(
                { source: 'topic-1', target: 'topic-2', type: 'related_to', weight: 8 },
                { source: 'topic-1', target: 'topic-3', type: 'related_to', weight: 6 },
                { source: 'topic-2', target: 'topic-4', type: 'related_to', weight: 4 },
                { source: 'topic-3', target: 'topic-4', type: 'related_to', weight: 5 },
                { source: 'topic-5', target: 'topic-2', type: 'related_to', weight: 7 },
                { source: 'topic-5', target: 'topic-3', type: 'related_to', weight: 6 }
            );
        }

        return { nodes, edges };
    };

    const graph = generateGraph(paperId, depth, type);

    // 计算图统计信息
    const stats = {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        avgConnections: graph.edges.length / graph.nodes.length,
        centrality: graph.nodes.map(n => ({
            id: n.id,
            label: n.label,
            degree: graph.edges.filter(e => e.source === n.id || e.target === n.id).length
        })).sort((a, b) => b.degree - a.degree).slice(0, 5)
    };

    return NextResponse.json({
        success: true,
        data: {
            graph,
            stats,
            metadata: {
                generated: new Date().toISOString(),
                depth,
                type
            }
        }
    });
}
