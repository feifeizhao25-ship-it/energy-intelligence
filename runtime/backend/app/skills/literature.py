"""Copy literature fields that a skill already returned. Do not invent a title or a link."""
from __future__ import annotations

from typing import Mapping


def literature_metadata(result: Mapping) -> dict:
    raw = result.get("sources") or result.get("citations") or []
    items = []
    if isinstance(raw, list):
        for entry in raw:
            if not isinstance(entry, Mapping):
                continue
            title = entry.get("title")
            if not isinstance(title, str) or not title.strip():
                continue
            url = entry.get("url") or entry.get("link") or ""
            retrieved = entry.get("retrieved_at") or ""
            items.append({
                "title": title.strip(),
                "url": url if isinstance(url, str) else "",
                "retrieved_at": retrieved if isinstance(retrieved, str) else "",
            })
    return {"items": items, "status": "attached" if items else "none_attached"}
