/** 页脚版本号。提交号由构建环境写入，源码里不写死。 */
export function BuildStamp() {
    const sha = process.env.NEXT_PUBLIC_GIT_SHA?.trim() || '未写入';
    return (
        <footer data-testid="build-stamp" className="bg-white px-4 py-2 text-center text-xs font-bold text-slate-900">
            新能源智库 · 版本 {sha}
        </footer>
    );
}
