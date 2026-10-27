'use client';

/**
 * AI 回答渲染：Markdown（GFM 表格/列表）+ KaTeX 公式（$...$ 与 $$...$$）。
 * 不启用原始 HTML 插件：模型输出中的 HTML 一律按文本显示，避免 XSS。
 * 链接新窗口打开并带 rel="noopener noreferrer"。
 * 定义、定理、公式、注意框，以及流程图、图表、图片和视频代码块在这里一起渲染。
 */
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';
import { MermaidBlock } from '@/components/ai/MermaidBlock';
import { ChartSpecView } from '@/components/charts/ChartSpecView';
import { MediaFrame } from '@/components/media/MediaFrame';
import { parseCallouts } from '@/lib/ai/directives';

const TONE: Record<string, string> = {
    定义: 'border-[var(--moss)] bg-[var(--paper)]',
    定理: 'border-[var(--ink)] bg-white',
    公式: 'border-[var(--line)] bg-white',
    注意: 'border-[var(--warn)] bg-white',
};

const WRAP = 'ai-markdown space-y-2 overflow-x-auto [&_table]:w-full [&_table]:text-left [&_th]:border-b [&_th]:px-2 [&_td]:px-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_a]:underline [&_.katex-display]:overflow-x-auto';

function fence(className: string | undefined, children: ReactNode) {
    const text = String(children).replace(/\n$/, '');
    const lang = /language-([\w-]+)/.exec(className || '')?.[1];
    if (lang === 'mermaid') return <MermaidBlock source={text} />;
    if (lang === 'chart') {
        try {
            return <ChartSpecView source={JSON.parse(text)} />;
        } catch {
            return <ChartSpecView source={null} />;
        }
    }
    if (lang === 'video') {
        try {
            const data = JSON.parse(text) as { src?: string; alt?: string; poster?: string; captions?: string; generated?: boolean };
            return (
                <MediaFrame
                    kind="video"
                    src={data.src || ''}
                    alt={data.alt || ''}
                    poster={data.poster}
                    captions={data.captions}
                    generated={Boolean(data.generated)}
                />
            );
        } catch {
            return <p>视频无法显示</p>;
        }
    }
    return null;
}

function MarkdownBody({ content, className }: { content: string; className?: string }) {
    return (
        <div className={[WRAP, className].filter(Boolean).join(' ')}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
                components={{
                    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                    img: ({ src, alt }) => {
                        try {
                            return <MediaFrame alt={alt || ''} src={typeof src === 'string' ? src : ''} />;
                        } catch {
                            return <p>图片缺少替代文本</p>;
                        }
                    },
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className: codeClass, children }) => fence(codeClass, children) ?? <code className={codeClass}>{children}</code>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export function AiMarkdown({ content, className }: { content: string; className?: string }) {
    const blocks = parseCallouts(content);
    if (!blocks.some((block) => block.type === 'callout')) {
        return <MarkdownBody content={content} className={className} />;
    }
    return (
        <div className={['space-y-3', className].filter(Boolean).join(' ')}>
            {blocks.map((block, index) => {
                if (block.type === 'markdown') {
                    return <MarkdownBody key={`md-${index}`} content={block.text} />;
                }
                return (
                    <section key={`box-${block.number}`} className={`rounded-xl border-l-4 px-3 py-2 ${TONE[block.kind] || ''}`} data-callout={block.kind}>
                        <p className="text-xs font-semibold text-[var(--ink-soft)]">{block.kind} {block.number}</p>
                        <MarkdownBody content={block.body} />
                    </section>
                );
            })}
        </div>
    );
}

export default AiMarkdown;
