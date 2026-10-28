"""已核对的外部条目。只把「直接集成 / 加入自动监测清单」放进待审候选。

不建议、非商用、GPL、AGPL 和价格预测一律不进入候选。
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ITEMS = ROOT / "data" / "research" / "research_items.json"
ALLOWED = {"直接集成", "加入自动监测清单"}
BLOCKED_FLAGS = {"非商用", "GPL传染性", "AGPL传染性"}


def _blob(item: dict) -> str:
    parts = [
        str(item.get("license") or ""),
        " ".join(str(flag) for flag in item.get("license_flags") or []),
        str(item.get("name") or ""),
        str(item.get("summary_zh") or ""),
        str(item.get("reason") or ""),
    ]
    return " ".join(parts).lower()


def eligible(item: dict) -> bool:
    if not isinstance(item, dict):
        return False
    if item.get("recommendation") not in ALLOWED:
        return False
    flags = {str(flag) for flag in item.get("license_flags") or []}
    if flags & BLOCKED_FLAGS:
        return False
    text = _blob(item)
    if any(token in text for token in ("agpl", "gpl-2", "gpl-3", "gpl-3.0", "cc-by-nc", "非商用")):
        return False
    if "价格预测" in text or "电价预测" in text or ("price" + " forecast") in text:
        return False
    return True


def load_items(path: Path | None = None) -> list[dict]:
    file = path or ITEMS
    if not file.is_file():
        return []
    try:
        payload = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    rows = payload.get("items") if isinstance(payload, dict) else payload
    return [row for row in rows or [] if isinstance(row, dict)]


def research_candidates(items: list[dict] | None = None) -> list[dict]:
    found = []
    for item in items if items is not None else load_items():
        if not eligible(item):
            continue
        found.append({
            "kind": "research",
            "name": str(item.get("name") or "未命名")[:180],
            "url": str(item.get("url") or "")[:400],
            "license": str(item.get("license") or "未标明")[:80],
            "recommendation": item.get("recommendation"),
            "query": "research",
            "auto_apply": False,
            "note": "来自已核对清单，只进入待审，不自动入库。",
        })
    return found
