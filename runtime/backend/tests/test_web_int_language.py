"""web-int user-facing text stays English unless a line is on the allowlist.

PR 116's broader language gate is not what this file repeats. This test covers
the international site's route tree, the modules those routes render, and the
cookie module added beside them.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "runtime" / "web-int" / "src"
ALLOW = ROOT / "scripts" / "web_int_language.allowlist"
CJK = re.compile(r"[一-鿿]")
BLOCK = re.compile(r"/\*.*?\*/", re.S)


def _hits() -> set[str]:
    hits: set[str] = set()
    for path in SRC.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".json", ".mjs"} or ".test." in path.name:
            continue
        raw = path.read_text(encoding="utf-8")
        text = BLOCK.sub(lambda match: re.sub(r"[^\n]", " ", match.group(0)), raw)
        rel = path.relative_to(SRC).as_posix()
        for number, line in enumerate(text.splitlines(), start=1):
            code = re.sub(r"//.*", "", line)
            if CJK.search(code):
                hits.add(f"{rel}:{number}")
    return hits


def _allowlist() -> set[str]:
    entries = set()
    for raw in ALLOW.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            entries.add(line)
    return entries


def test_web_int_user_facing_text_is_english_unless_allowlisted():
    assert (SRC / "app" / "page.tsx").is_file()
    assert (SRC / "app" / "layout.tsx").is_file()
    hits = _hits()
    allowed = _allowlist()
    assert sorted(hits - allowed) == []
    assert sorted(allowed - hits) == []
