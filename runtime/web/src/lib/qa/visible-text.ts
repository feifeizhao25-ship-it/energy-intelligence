/** 连续五个以上英文单词视为可见英文句。专有名词应改成中文或缩写加中文。 */
export function hasLongEnglishRun(text: string): boolean {
    return /[A-Za-z]+(?:\s+[A-Za-z]+){4,}/.test(text);
}
