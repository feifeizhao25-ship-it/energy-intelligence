export const CALLOUT_KINDS = ['定义', '定理', '公式', '注意'] as const;
export type CalloutKind = typeof CALLOUT_KINDS[number];

export type MarkdownBlock =
    | { type: 'markdown'; text: string }
    | { type: 'callout'; kind: CalloutKind; number: number; body: string };

const OPEN = /:::((?:定义|定理|公式|注意))\s*\n/;

/** 把四种块切出来并连续编号。不成对的开头原样留在正文里。 */
export function parseCallouts(markdown: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    let cursor = 0;
    let number = 0;
    const source = markdown || '';
    while (cursor < source.length) {
        const slice = source.slice(cursor);
        const open = OPEN.exec(slice);
        if (!open || open.index === undefined) {
            const rest = source.slice(cursor);
            if (rest) blocks.push({ type: 'markdown', text: rest });
            break;
        }
        const start = cursor + open.index;
        if (start > cursor) blocks.push({ type: 'markdown', text: source.slice(cursor, start) });
        const kind = open[1] as CalloutKind;
        const bodyStart = start + open[0].length;
        const close = source.indexOf('\n:::', bodyStart);
        if (close < 0) {
            blocks.push({ type: 'markdown', text: source.slice(start) });
            break;
        }
        number += 1;
        blocks.push({ type: 'callout', kind, number, body: source.slice(bodyStart, close).trim() });
        cursor = close + 4;
    }
    return blocks;
}
