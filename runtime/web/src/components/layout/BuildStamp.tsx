/** 页脚只写产品名。提交号和构建日期不出现在用户看得见的界面上。 */
export function BuildStamp() {
    return (
        <footer data-testid="build-stamp" className="max-w-full text-xs text-[var(--ink-soft)] [overflow-wrap:anywhere]">
            新能源智库
        </footer>
    );
}
