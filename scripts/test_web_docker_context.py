#!/usr/bin/env python3
"""runtime/web 镜像构建上下文自测：Dockerfile 要用的文件，必须真的在构建上下文里。

背景（没有 docker 守护进程也能证明的两个构建失败）：
  1. Dockerfile 在 builder 阶段 `COPY . .` 之后执行 `node scripts/validate-public-build-config.mjs`，
     而 .dockerignore 写了一行 `scripts` 把整个 scripts/ 排除了——构建期检查脚本进不了镜像，
     `RUN node scripts/...` 直接 MODULE_NOT_FOUND，镜像根本构建不出来。
  2. runner 阶段 `COPY --from=builder /app/public ./public`，而仓库里没有 public/ 目录
     （页面却引用 /manifest.json、/icons/icon-192x192.png）：COPY 找不到源路径，同样构建失败。
jest 与 tsc 都不会发现这两件事，只有真去 docker build 才会——而 CI 里没有这一步。

这里按 Docker 的 .dockerignore 语义（逐条匹配，后面的规则覆盖前面的，! 表示重新包含）
静态推演构建上下文，不需要 docker。
"""
import fnmatch
import pathlib
import re
import unittest

WEB = pathlib.Path(__file__).resolve().parent.parent / "runtime" / "web"

# 由构建过程产出、不在源码里的路径
BUILD_OUTPUTS = (".next/", "node_modules")


def load_ignore_rules() -> list[tuple[bool, str]]:
    rules = []
    for raw in (WEB / ".dockerignore").read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        negate = line.startswith("!")
        rules.append((negate, line[1:] if negate else line))
    return rules


def _match(pattern: str, path: str) -> bool:
    pattern = pattern.strip("/")
    parts = path.split("/")
    # 规则可以命中路径本身，或它的任一父目录
    for i in range(1, len(parts) + 1):
        candidate = "/".join(parts[:i])
        if pattern.startswith("**/"):
            if fnmatch.fnmatch(candidate, pattern) or fnmatch.fnmatch(candidate, pattern[3:]) or \
                    fnmatch.fnmatch(candidate.split("/")[-1], pattern[3:]):
                return True
        elif fnmatch.fnmatch(candidate, pattern):
            return True
    return False


def in_context(path: str, rules=None) -> bool:
    """path 是否会被送进构建上下文（相对 runtime/web）。"""
    rules = load_ignore_rules() if rules is None else rules
    ignored = False
    for negate, pattern in rules:
        if _match(pattern, path):
            ignored = not negate
    return not ignored


def dockerfile_lines() -> list[str]:
    text = (WEB / "Dockerfile").read_text(encoding="utf-8").replace("\\\n", " ")
    return [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]


class DockerContextTests(unittest.TestCase):
    def test_ignore_matcher_semantics(self):
        self.assertFalse(in_context("scripts/a.mjs", [(False, "scripts")]))
        self.assertFalse(in_context("scripts/sub/a.mjs", [(False, "scripts")]))
        self.assertTrue(in_context("src/scripts/a.mjs", [(False, "scripts")]))
        rules = [(False, "scripts/*"), (True, "scripts/a.mjs")]
        self.assertTrue(in_context("scripts/a.mjs", rules))
        self.assertFalse(in_context("scripts/b.mjs", rules))
        self.assertFalse(in_context("src/x/y.test.ts", [(False, "**/*.test.ts")]))
        self.assertTrue(in_context("src/x/y.ts", [(False, "**/*.test.ts")]))

    def test_build_stage_scripts_are_in_context(self):
        """builder 阶段 RUN 里用到的 scripts/* 必须存在，且没被 .dockerignore 排除。"""
        used = set()
        for line in dockerfile_lines():
            if line.startswith("RUN "):
                used.update(re.findall(r"\b(scripts/[\w./-]+\.(?:mjs|js|cjs|ts))", line))
        self.assertIn("scripts/validate-public-build-config.mjs", used)
        for path in sorted(used):
            self.assertTrue((WEB / path).is_file(), f"{path} 不存在")
            self.assertTrue(in_context(path), f"{path} 被 .dockerignore 排除，docker build 时 RUN 会找不到它")

    def test_copy_from_builder_sources_exist(self):
        """COPY --from=builder /app/<x>：x 要么是构建产物，要么必须存在于（且未被排除出）上下文。"""
        checked = []
        for line in dockerfile_lines():
            m = re.match(r"COPY\s+(?:--\S+\s+)*--from=builder\s+(?:--\S+\s+)*(/app/\S+)\s+\S+", line) or \
                re.match(r"COPY\s+(?:--\S+\s+)*(?:--from=builder)\s+(/app/\S+)", line)
            if not m:
                continue
            src = m.group(1)[len("/app/"):]
            if src.startswith(BUILD_OUTPUTS):
                continue
            checked.append(src)
            self.assertTrue((WEB / src).exists(), f"COPY --from=builder /app/{src}：仓库里没有 {src}，构建会失败")
            self.assertTrue(in_context(src.rstrip("/")), f"/app/{src} 被 .dockerignore 排除")
        self.assertIn("public", checked)
        self.assertIn("src/prisma", checked)

    def test_prisma_migrations_reach_the_runner_image(self):
        for path in (WEB / "src" / "prisma" / "migrations").glob("*/migration.sql"):
            rel = str(path.relative_to(WEB))
            self.assertTrue(in_context(rel), f"{rel} 被 .dockerignore 排除，容器启动时 migrate deploy 缺迁移")
        self.assertTrue(in_context("src/prisma/schema.prisma"))
        self.assertTrue(in_context("docker-entrypoint.sh"))
        self.assertTrue(in_context("package-lock.json"))
        self.assertTrue(in_context(".npmrc"))

    def test_static_assets_referenced_by_layout_exist(self):
        """根布局引用的静态文件（manifest、桌面图标）必须在 public/ 里，不能靠 404 兜底。"""
        layouts = (WEB / "src/app/layout.tsx").read_text(encoding="utf-8")
        refs = set(re.findall(r"""['"](/(?:manifest\.json|icons/[\w.-]+\.png))['"]""", layouts))
        self.assertTrue(refs)
        for ref in sorted(refs):
            self.assertTrue((WEB / "public" / ref.lstrip("/")).is_file(), f"public{ref} 不存在")


if __name__ == "__main__":
    unittest.main()
