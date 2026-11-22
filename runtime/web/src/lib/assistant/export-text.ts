/**
 * 回答正文写进 PDF / Word 前的整理（2026-11-21 测试）：
 * - 原样保留了 `**加粗**`、`### 标题`、`- 列表`，PDF 和 Word 里都是星号和井号；
 * - 整段带换行的文字塞进一个 <w:t>，Word 里标题、列表挤成一段；
 * - 导出字体没有 emoji 字形，💡 在 PDF 里变成乱码。
 * 这里把 markdown 换成纯文本行（一行一段），emoji 换成文字或去掉。只改排版符号，不改文字内容。
 */

const EMOJI_WORDS: Array<[RegExp, string]> = [
  [/💡\uFE0F?/gu, '提示：'],
  [/⚠️|⚠\uFE0F?/gu, '注意：'],
  [/✅\uFE0F?/gu, '√ '],
  [/❌\uFE0F?/gu, '× '],
  [/📌\uFE0F?/gu, '要点：'],
];
const EMOJI = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D(?:\p{Extended_Pictographic}))*|[\uFE0F\u200D\u20E3]/gu;

export function stripEmoji(text: string): string {
  let out = text;
  for (const [re, word] of EMOJI_WORDS) out = out.replace(re, word);
  return out.replace(EMOJI, '').replace(/(提示|注意|要点)：\s*(?:[：:]\s*)?/g, '$1：');
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1（$2）')
    .replace(/\*\*/g, '');
}

/** markdown 回答 → 导出用的纯文本行。空行去掉，表格行按单元格拼接，分隔行去掉。 */
export function markdownToExportLines(markdown: string): string[] {
  const lines: string[] = [];
  for (const raw of String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    if (/^(?:[-*_]\s*){3,}$/.test(line)) continue; // 分隔线
    if (/^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/.test(line)) continue; // 表格分隔行
    if (/^```/.test(line)) continue;
    line = line.replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '');
    if (/^\|.*\|$/.test(line)) {
      line = line.slice(1, -1).split('|').map((cell) => cell.trim()).filter(Boolean).join('　');
    }
    line = line.replace(/^[-*+]\s+/, '• ');
    line = stripEmoji(inline(line)).trim();
    if (line) lines.push(line);
  }
  return lines;
}
