"""Typst 报告源码。本机有 typst 时才编译，没有就只返回源码。"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

TEMPLATE = """#set text(font: ("Source Han Serif SC", "Noto Serif SC", "Noto Sans SC"), lang: "zh")
#set heading(numbering: "1.1")
#show heading: set text(font: ("Source Han Sans SC", "Noto Sans SC"))

= {title}

{body}

== 免责
本页为测算或资料汇编，非正式文件。数字为测算值，不构成收益承诺。
"""


def render_source(title: str, body: str) -> str:
    return TEMPLATE.format(title=title.replace("#", ""), body=body)


def compile_pdf(source: str, destination: Path) -> dict:
    binary = shutil.which("typst")
    if not binary:
        return {"compiled": False, "reason": "typst missing", "source": source}
    source_path = destination.with_suffix(".typ")
    source_path.write_text(source, encoding="utf-8")
    proc = subprocess.run([binary, "compile", str(source_path), str(destination)], capture_output=True, text=True, check=False)
    return {"compiled": proc.returncode == 0, "stderr": proc.stderr[-400:], "pdf": str(destination)}
