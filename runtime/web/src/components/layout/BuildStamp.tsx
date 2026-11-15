/** 页脚版本号。提交号和日期在构建时写入，源码里不写死某一次提交。 */
export function BuildStamp() {
    const sha = process.env.NEXT_PUBLIC_GIT_SHA?.trim() || '未写入';
    const date = process.env.NEXT_PUBLIC_BUILD_DATE?.trim() || '';
    return (
        <footer data-testid="build-stamp" className="max-w-full text-xs text-[var(--ink-soft)] [overflow-wrap:anywhere]">
            新能源智库 · 版本 {sha}{date ? ` · ${date}` : ''}
        </footer>
    );
}
