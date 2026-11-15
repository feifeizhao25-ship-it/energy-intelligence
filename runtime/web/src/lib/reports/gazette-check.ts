export function gazetteCoverOk(text: string): boolean {
    return text.includes('资料汇编') && text.includes('非正式文件') && !text.includes('红头') && !text.includes('公章');
}
