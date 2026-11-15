/** 汉字与数字、拉丁字母之间补空格；数字与单位字母之间也补空格，不断行由样式保证。 */
export function spaceCjkLatin(text: string): string {
    return text
        .replace(/([\u4e00-\u9fff])([0-9A-Za-z])/g, '$1 $2')
        .replace(/([0-9A-Za-z])([\u4e00-\u9fff])/g, '$1 $2')
        .replace(/(\d)([A-Za-z])/g, '$1 $2')
        .replace(/([A-Za-z])(\d)/g, '$1 $2');
}
