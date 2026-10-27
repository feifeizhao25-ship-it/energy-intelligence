'use client';

import { useEffect, useId, useState } from 'react';

const UNSAFE = /script|javascript:|onclick|onerror|<iframe|<foreignObject/i;

export interface FlowFigure {
    ok: boolean;
    securityLevel: 'strict';
    nodes: string[];
    reason?: string;
}

/** 只接受流程图文本。拒绝脚本和内嵌页面，对应严格沙箱。 */
export function readFlow(source: string): FlowFigure {
    const text = source.trim();
    if (!/^(flowchart|graph)\s+/i.test(text) || UNSAFE.test(text)) {
        return { ok: false, securityLevel: 'strict', nodes: [], reason: '流程图无法显示' };
    }
    const nodes = new Set<string>();
    for (const match of text.matchAll(/([A-Za-z0-9_\u4e00-\u9fff]+)[\[(]([^\]）)]+)[\]）)]/g)) {
        nodes.add(match[2].trim());
    }
    for (const match of text.matchAll(/([A-Za-z0-9_\u4e00-\u9fff]+)\s*-->\s*([A-Za-z0-9_\u4e00-\u9fff]+)/g)) {
        nodes.add(match[1]);
        nodes.add(match[2]);
    }
    if (nodes.size === 0) {
        return { ok: false, securityLevel: 'strict', nodes: [], reason: '流程图无法显示' };
    }
    return { ok: true, securityLevel: 'strict', nodes: [...nodes] };
}

function fallbackSvg(nodes: string[]): string {
    const width = 280;
    const row = 48;
    const height = nodes.length * row + 16;
    const boxes = nodes.map((node, index) => {
        const y = 12 + index * row;
        const label = node.replace(/[<>&]/g, '');
        return `<rect x="40" y="${y}" width="200" height="32" rx="8" fill="#f4f7f5" stroke="#245C45"/>
        <text x="140" y="${y + 21}" text-anchor="middle" font-size="13" fill="#12201F">${label}</text>
        ${index < nodes.length - 1 ? `<path d="M140 ${y + 32} V ${y + row}" stroke="#245C45" marker-end="url(#arrow)"/>` : ''}`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img">
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#245C45"/></marker></defs>
      ${boxes}
    </svg>`;
}

export function MermaidBlock({ source }: { source: string }) {
    const figure = readFlow(source);
    const reactId = useId().replace(/:/g, '');
    const [svg, setSvg] = useState('');
    useEffect(() => {
        if (!figure.ok) return;
        let cancelled = false;
        import('mermaid')
            .then((mod) => {
                const mermaid = mod.default;
                mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
                return mermaid.render(`flow${reactId}`, source);
            })
            .then((result) => {
                if (!cancelled && result?.svg && !UNSAFE.test(result.svg)) setSvg(result.svg);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [source, figure.ok, reactId]);
    if (!figure.ok) {
        return <p data-testid="flow-error">{figure.reason}</p>;
    }
    const shown = svg || fallbackSvg(figure.nodes);
    return (
        <figure data-testid="flow-figure" data-security={figure.securityLevel} className="overflow-x-auto" aria-label="流程图">
            <div dangerouslySetInnerHTML={{ __html: shown }} />
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {figure.nodes.map((node) => <li key={node}>{node}</li>)}
            </ol>
        </figure>
    );
}
