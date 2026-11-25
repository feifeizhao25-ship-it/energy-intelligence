#!/usr/bin/env python3
"""接口错误文案的语言检查。

国内版句子不得含完整英文句（连续 5 个及以上英文单词）。
国际版句子不得含中日韩字符。
对照表在 runtime/backend/app/errors/catalog.json，文档必须收录每一条。

白名单：scripts/api_language.allowlist
每行 `代码` 或 `代码:zh` / `代码:en`，# 开头为注释。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "runtime" / "backend" / "app" / "errors" / "catalog.json"
DOCUMENT = ROOT / "docs" / "grok_review_20261124" / "错误码对照表.md"
ALLOW = ROOT / "scripts" / "api_language.allowlist"

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
ENGLISH_SENTENCE = re.compile(r"[A-Za-z]+(?:[’'][A-Za-z]+)?(?:\s+[A-Za-z]+(?:[’'][A-Za-z]+)?){4,}")


def allowlist() -> set[str]:
    found: set[str] = set()
    if not ALLOW.exists():
        return found
    for raw in ALLOW.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            found.add(line)
    return found


def allowed(code: str, side: str, waived: set[str]) -> bool:
    return code in waived or f"{code}:{side}" in waived


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    document = DOCUMENT.read_text(encoding="utf-8") if DOCUMENT.exists() else ""
    waived = allowlist()
    problems: list[str] = []
    for code, row in catalog.items():
        zh = row.get("zh") or ""
        en = row.get("en") or ""
        if code not in document or zh not in document or en not in document:
            problems.append(f"{code}: 文档未收录这条中英对照")
        if not allowed(code, "zh", waived) and ENGLISH_SENTENCE.search(zh):
            problems.append(f"{code}: 国内文案含完整英文句：{zh}")
        if not allowed(code, "en", waived) and CJK.search(en):
            problems.append(f"{code}: 国际文案含中文：{en}")
    if problems:
        print("接口语言检查未通过：")
        for item in problems:
            print(f"  - {item}")
        return 1
    print(f"接口语言检查通过。已核对 {len(catalog)} 条错误码。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
