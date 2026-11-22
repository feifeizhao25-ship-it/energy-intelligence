/**
 * 模型有时会把内部用的伪标签写进正文，例如
 *   <ds_safety>[分类]政治 …</ds_safety>
 *   <ds_tool>（调用 query_knowledge_base 工具…）</ds_tool>
 * 这些不是给用户看的：成对的标签连同内容一起去掉，落单的开/闭标签也去掉。
 */
const PAIRED = /<(ds_[a-z0-9_]+)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const UNCLOSED_TAIL = /<ds_[a-z0-9_]+\b[^>]*>[\s\S]*$/i;
const LONE = /<\/?ds_[a-z0-9_]+\b[^>]*>/gi;

export function stripLeakedModelTags(text: string): string {
    if (!text || !/<\/?ds_/i.test(text)) return text;
    let out = text.replace(PAIRED, '');
    // 开了没关（流被截断或模型写了一半）：从开标签起到结尾都是内部内容。
    out = out.replace(UNCLOSED_TAIL, '');
    out = out.replace(LONE, '');
    return out.replace(/\n{3,}/g, '\n\n').trim();
}
