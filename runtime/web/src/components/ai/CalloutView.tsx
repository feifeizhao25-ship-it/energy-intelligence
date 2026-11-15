import { parseCallouts } from '@/lib/ai/directives';
import AiMarkdown from '@/components/ai/AiMarkdown';

const TONE: Record<string, string> = {
    定义: 'border-[var(--moss)] bg-[var(--paper)]',
    定理: 'border-[var(--ink)] bg-white',
    公式: 'border-[var(--line)] bg-white',
    注意: 'border-[var(--warn)] bg-white',
};

export function CalloutView({ markdown }: { markdown: string }) {
    const blocks = parseCallouts(markdown);
    return (
        <div className="space-y-3">
            {blocks.map((block, index) => {
                if (block.type === 'markdown') {
                    return <AiMarkdown key={`md-${index}`} content={block.text} />;
                }
                return (
                    <section key={`box-${block.number}`} className={`rounded-xl border-l-4 px-3 py-2 ${TONE[block.kind]}`} data-callout={block.kind}>
                        <p className="text-xs font-semibold text-[var(--ink-soft)]">{block.kind} {block.number}</p>
                        <AiMarkdown content={block.body} />
                    </section>
                );
            })}
        </div>
    );
}
