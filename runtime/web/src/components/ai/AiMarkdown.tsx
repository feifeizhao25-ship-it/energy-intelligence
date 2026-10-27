'use client';

/**
 * AI 回答渲染：Markdown（GFM 表格/列表）+ KaTeX 公式（$...$ 与 $$...$$）。
 * 不启用原始 HTML 插件：模型输出中的 HTML 一律按文本显示，避免 XSS。
 * 链接新窗口打开并带 rel="noopener noreferrer"。
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';

export function AiMarkdown({ content, className }: { content: string; className?: string }) {
    return (
        <div className={['ai-markdown space-y-2 [&_table]:w-full [&_table]:text-left [&_th]:border-b [&_th]:px-2 [&_td]:px-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_a]:underline [&_.katex-display]:overflow-x-auto', className].filter(Boolean).join(' ')}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
                components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export default AiMarkdown;
