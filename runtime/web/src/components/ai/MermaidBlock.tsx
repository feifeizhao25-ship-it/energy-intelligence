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

export function MermaidBlock({ source }: { source: string }) {
    const figure = readFlow(source);
    if (!figure.ok) {
        return <p data-testid="flow-error">{figure.reason}</p>;
    }
    return (
        <ol data-testid="flow-figure" data-security={figure.securityLevel} className="list-decimal space-y-1 pl-5 text-sm">
            {figure.nodes.map((node) => <li key={node}>{node}</li>)}
        </ol>
    );
}
