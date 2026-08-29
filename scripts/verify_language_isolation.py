#!/usr/bin/env python3
"""语言隔离 CI 校验 — 项目-新能源智库

规则:
- 国际版: .ts/.tsx/.js/.jsx 中 JSX 文本节点与用户可见字符串
  不得出现 CJK 字符([一-鿿])。
- 国内版: JSX 文本节点中不得出现长篇英文
  (连续 >= 5 个自然语言英文单词;品牌名/技术词/变量插值不计)。

⚠️ 2026-08-18 更正:原先检查的是 frontend-cn-web/src 与 web-global/src,
   而 runtime/docker-compose.production.yml 实际部署的是 runtime/web(53 页)
   与 runtime/web-int(3 页)。frontend-cn-web 只有 0 个页面(空壳),
   web-global 根本没有被部署 —— 也就是说这个检查一直跑在没上线的代码上,
   真正面向用户的 374 个文件从未被检查过。
   现改为扫描全部候选目录,存在即检查。

豁免:
- i18n / locales 语言包目录
- 注释(行注释与块注释)
- import/export from / require 的模块路径
- 测试文件: __tests__/ 目录、*.test.*、*.spec.*
- node_modules、.next、dist、build 目录
- 后端 后端/app: market 双语检查已由 RAG 层隔离测试覆盖,本脚本只覆盖前端。

补充豁免(待办)可写入 scripts/language_isolation.allowlist,
每行一条: "<相对路径>" 或 "<相对路径>:<行号>",# 开头为注释。

用法: python3 scripts/verify_language_isolation.py
退出码: 0 通过;1 发现违规。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 生产部署的前端在 runtime/ 下(见 runtime/docker-compose.production.yml);
# web-global / frontend-cn-web 是历史目录,保留检查以防回流。
INTL_SRCS = [
    ROOT / "runtime" / "web-int" / "src",
    ROOT / "web-global" / "src",
    ROOT / "android-global" / "lib",
    ROOT / "ios-global" / "lib",
]
CN_SRCS = [
    ROOT / "runtime" / "web" / "src",
    ROOT / "frontend-cn-web" / "src",
]
ALLOWLIST_FILE = ROOT / "scripts" / "language_isolation.allowlist"

SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".dart"}
JSX_EXTS = {".tsx", ".jsx"}

SKIP_DIR_NAMES = {"node_modules", ".next", "dist", "build", "__tests__", "i18n", "l10n", "locales"}
CJK_RE = re.compile(r"[一-鿿]")

# import 路径豁免:剥掉模块说明符后再查 CJK
IMPORT_PATH_RES = [
    re.compile(r"""(?:import|export)\b[^'"]*(['"])[^'"]*\1"""),
    re.compile(r"""(?:require|import)\s*\(\s*(['"])[^'"]*\1\s*\)"""),
]

# 品牌名 / 技术词:在国内版英文句检测中作为“中性词”,不计入自然语言单词数
NEUTRAL_TERMS = {
    "api", "sdk", "url", "ui", "ux", "ai", "gpt", "llm", "seo", "faq", "pdf",
    "csv", "json", "html", "css", "dom", "cdn", "dns", "oauth", "jwt", "qr",
    "id", "ip", "db", "sql", "nosql", "iot", "vr", "ar", "kpi", "roi", "saas",
    "paas", "iaas", "crm", "erp", "cms", "ci", "cd", "ide", "gpu", "cpu", "ram",
    "http", "https", "websocket", "tcp", "ssl", "tls", "npm", "node", "next",
    "nextjs", "react", "vue", "typescript", "javascript", "python", "docker",
    "kubernetes", "github", "gitlab", "markdown", "openai", "deepseek", "claude",
    "chatgpt", "midjourney", "tiktok", "youtube", "twitter", "facebook",
    "instagram", "wechat", "weibo", "xiaohongshu", "douyin", "bilibili",
    "contentflow", "aurenix", "token", "tokens", "web", "app", "ok",
}

WORD_RE = re.compile(r"[A-Za-z]+(?:['’\-][A-Za-z]+)*")

MIN_ENGLISH_SENTENCE_WORDS = 5


def strip_comments(source: str) -> str:
    """移除 // 与 /* */ 注释(用空格替换,保留换行以维持行号)。

    单/双/反引号字符串内容原样保留;字符串中的 // 不会被当作注释。
    """
    out: list[str] = []
    i, n = 0, len(source)
    state = "code"  # code | sq | dq | tpl | line_comment | block_comment
    while i < n:
        ch = source[i]
        nxt = source[i + 1] if i + 1 < n else ""
        if state == "code":
            if ch == "/" and nxt == "/":
                state = "line_comment"
                out.append("  ")
                i += 2
            elif ch == "/" and nxt == "*":
                state = "block_comment"
                out.append("  ")
                i += 2
            elif ch == "'":
                state = "sq"
                out.append(ch)
                i += 1
            elif ch == '"':
                state = "dq"
                out.append(ch)
                i += 1
            elif ch == "`":
                state = "tpl"
                out.append(ch)
                i += 1
            else:
                out.append(ch)
                i += 1
        elif state in ("sq", "dq", "tpl"):
            quote = {"sq": "'", "dq": '"', "tpl": "`"}[state]
            if ch == "\\":
                out.append(ch)
                if i + 1 < n:
                    out.append(source[i + 1])
                i += 2
            elif ch == quote:
                state = "code"
                out.append(ch)
                i += 1
            else:
                out.append(ch)
                i += 1
        elif state == "line_comment":
            if ch == "\n":
                state = "code"
                out.append(ch)
            else:
                out.append(" ")
            i += 1
        else:  # block_comment
            if ch == "*" and nxt == "/":
                state = "code"
                out.append("  ")
                i += 2
            else:
                out.append("\n" if ch == "\n" else " ")
                i += 1
    return "".join(out)


def iter_source_files(src_dir: Path):
    if not src_dir.is_dir():
        return
    for path in sorted(src_dir.rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_EXTS:
            continue
        rel_parts = path.relative_to(src_dir).parts
        if any(part in SKIP_DIR_NAMES for part in rel_parts[:-1]):
            continue
        name = path.name
        if ".test." in name or ".spec." in name:
            continue
        yield path


def load_allowlist() -> set[str]:
    entries: set[str] = set()
    if ALLOWLIST_FILE.is_file():
        for raw in ALLOWLIST_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if line and not line.startswith("#"):
                entries.add(line)
    return entries


def is_allowlisted(allowlist: set[str], rel: str, lineno: int) -> bool:
    return rel in allowlist or f"{rel}:{lineno}" in allowlist


def strip_import_paths(line: str) -> str:
    for pattern in IMPORT_PATH_RES:
        line = pattern.sub(" ", line)
    return line


def check_intl(src_dir: Path, allowlist: set[str]) -> list[str]:
    """国际版:注释剥离后仍存在 CJK 即违规(import 路径除外)。"""
    violations: list[str] = []
    for path in iter_source_files(src_dir):
        rel = path.relative_to(ROOT).as_posix()
        text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        for lineno, line in enumerate(text.splitlines(), 1):
            if not CJK_RE.search(line):
                continue
            stripped = strip_import_paths(line)
            if not CJK_RE.search(stripped):
                continue
            if is_allowlisted(allowlist, rel, lineno):
                continue
            excerpt = line.strip()[:100]
            violations.append(f"[INTL] {rel}:{lineno}: {excerpt}")
    return violations


def count_english_run(text: str) -> int:
    """统计文本中最长的连续自然语言英文单词数。

    品牌名/技术词与数字为中性:不重置计数也不计入;CJK 与引号等会打断句子。
    """
    best = 0
    current = 0
    pos = 0
    for match in WORD_RE.finditer(text):
        between = text[pos:match.start()]
        if CJK_RE.search(between):
            current = 0
        word = match.group(0).lower().replace("’", "'")
        if word in NEUTRAL_TERMS or len(word) <= 1:
            pass  # 中性词,不影响计数
        else:
            current += 1
            best = max(best, current)
        pos = match.end()
    return best


JSX_TEXT_RE = re.compile(r">([^<>]+)<", re.DOTALL)
JSX_EXPR_RE = re.compile(r"\{[^{}]*\}")

# 代码特征:命中的 “>...<” 片段不是 JSX 文本节点,而是比较/泛型/箭头函数等代码
CODE_TOKEN_RE = re.compile(
    r"(;|=>|===|!==|&&|\|\||\bconst\b|\blet\b|\bvar\b|\bfunction\b"
    r"|\breturn\b|\bexport\b|\bimport\b|\btypeof\b|\bnew\b|`\$)"
)


def check_cn(src_dir: Path, allowlist: set[str]) -> list[str]:
    """国内版:JSX 文本节点中出现 >=5 个连续英文自然语言单词即违规。"""
    violations: list[str] = []
    for path in iter_source_files(src_dir):
        if path.suffix not in JSX_EXTS:
            continue
        rel = path.relative_to(ROOT).as_posix()
        text = strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        for match in JSX_TEXT_RE.finditer(text):
            node = match.group(1)
            if CODE_TOKEN_RE.search(node):
                continue  # 比较运算/泛型/箭头函数等代码片段,不是 JSX 文本
            # 去掉 {变量插值} 后再判断;仍残留花括号说明是嵌套表达式代码
            node = JSX_EXPR_RE.sub(" ", node)
            if "{" in node or "}" in node:
                continue
            if not node.strip():
                continue
            if count_english_run(node) < MIN_ENGLISH_SENTENCE_WORDS:
                continue
            lineno = text.count("\n", 0, match.start()) + 1
            if is_allowlisted(allowlist, rel, lineno):
                continue
            excerpt = " ".join(node.split())[:100]
            violations.append(f"[CN] {rel}:{lineno}: {excerpt}")
    return violations


def main() -> int:
    allowlist = load_allowlist()
    violations: list[str] = []
    checked: list[str] = []
    for src in INTL_SRCS:
        if src.is_dir():
            checked.append(src.relative_to(ROOT).as_posix())
            violations += check_intl(src, allowlist)
    for src in CN_SRCS:
        if src.is_dir():
            checked.append(src.relative_to(ROOT).as_posix())
            violations += check_cn(src, allowlist)

    # 国内生产包必须与国际版物理隔离，且会员权益必须与服务端配额一致。
    cn_home = ROOT / "runtime" / "web" / "src" / "app" / "page.tsx"
    cn_proxy = ROOT / "runtime" / "web" / "src" / "proxy.ts"
    if cn_home.is_file():
        home_text = cn_home.read_text(encoding="utf-8")
        for forbidden in ("LanguageSwitcher", "InternationalLanding", "测算与资源查询不限次"):
            if forbidden in home_text:
                violations.append(f"[CN-CONTRACT] {cn_home.relative_to(ROOT)}: 禁止出现 {forbidden!r}")
    if cn_proxy.is_file():
        proxy_text = cn_proxy.read_text(encoding="utf-8")
        required = ("locales: ['zh']", "defaultLocale: 'zh'", "path === '/en'", "localeDetection: false")
        for marker in required:
            if marker not in proxy_text:
                violations.append(f"[CN-CONTRACT] {cn_proxy.relative_to(ROOT)}: 缺少国内版隔离标记 {marker!r}")
    cn_web_src = ROOT / "runtime" / "web" / "src"
    for path in iter_source_files(cn_web_src):
        text = path.read_text(encoding="utf-8", errors="replace")
        if "OPENROUTER_API_KEY" in text or "openrouter.ai" in text:
            violations.append(
                f"[CN-PROVIDER] {path.relative_to(ROOT)}: 国内 Web 禁止直连 OpenRouter"
            )

    if not checked:
        print("语言隔离检查失败:没有找到任何前端源码目录")
        return 1

    if violations:
        print(f"语言隔离检查失败: {len(violations)} 条违规")
        for item in violations:
            print(f"  {item}")
        print()
        print("修复:国际版文案改为英文,国内版文案改为中文;")
        print(f"确需豁免的待办项写入 {ALLOWLIST_FILE.relative_to(ROOT)}")
        return 1
    print("语言隔离检查通过。已检查目录:")
    for c in checked:
        print(f"  - {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
