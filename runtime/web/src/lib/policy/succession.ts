/** 政策被替代时的界面句子。没有替代对象则不显示。 */
export function successionLabel(doc: { supersededBy?: string | null }, titles?: Record<string, string>): string | null {
    const target = doc.supersededBy?.trim();
    if (!target) return null;
    return `已被 ${titles?.[target] || target} 替代`;
}
