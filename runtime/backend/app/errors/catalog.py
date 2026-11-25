"""错误码对照表的唯一读取口。文案在 catalog.json，文档是它的对照表。"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).with_name("catalog.json")
DOCUMENT_PATH = Path(__file__).resolve().parents[4] / "docs" / "grok_review_20261124" / "错误码对照表.md"

SITUATIONS = ("E_CONFIG", "E_AUTH", "E_FORBIDDEN", "E_QUOTA", "E_COMPLIANCE", "E_SERVICE")


@lru_cache(maxsize=1)
def load_catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def public_message(code: str, market: str | None) -> str:
    row = load_catalog()[code]
    if (market or "cn") == "global":
        return row["en"]
    return row["zh"]
