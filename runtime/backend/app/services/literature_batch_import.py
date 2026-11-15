"""开放文献元数据的批量导入。只在 LITERATURE_BATCH_IMPORT=1 时由任务调用，请求处理不得调用。

不抓取知网。拉取函数由调用方注入，本模块不会在导入时自己访问境外接口。
"""

from __future__ import annotations

import json
import os
from pathlib import Path

FORBIDDEN_SOURCES = {"cnki", "知网"}


def cache_path() -> Path:
    raw = os.environ.get("NENGJIAN_LITERATURE_CACHE", "").strip()
    if raw:
        return Path(raw)
    return Path(__file__).resolve().parents[2] / "data" / "literature-cache.json"


def import_enabled() -> bool:
    return os.environ.get("LITERATURE_BATCH_IMPORT") == "1"


def validate_records(records: list[dict], licence_note: str) -> list[dict]:
    if len(licence_note.strip()) < 8:
        raise ValueError("许可说明过短")
    cleaned = []
    for row in records:
        source = str(row.get("source") or "").strip()
        if source.lower() in FORBIDDEN_SOURCES or "知网" in source:
            raise ValueError("不抓取知网")
        title = str(row.get("title") or "").strip()
        external_id = str(row.get("external_id") or "").strip()
        if not title or not external_id or not source:
            raise ValueError("语料需要标题、来源和外部标识")
        cleaned.append({
            "external_id": external_id,
            "title": title,
            "authors": str(row.get("authors") or "")[:200],
            "year": row.get("year"),
            "abstract": str(row.get("abstract") or "")[:1000],
            "doi": row.get("doi") or None,
            "url": row.get("url") or "",
            "source": source,
            "licence": str(row.get("licence") or "")[:200],
            "citations": row.get("citations") if isinstance(row.get("citations"), list) else [],
        })
    return cleaned


async def run_batch(fetcher, dest: Path | None = None, licence_note: str = "") -> dict:
    if not import_enabled():
        raise RuntimeError("文献批量导入未开启")
    records = await fetcher()
    cleaned = validate_records(list(records), licence_note)
    target = dest or cache_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "licence_note": licence_note.strip(),
        "records": cleaned,
        "fetched_live_on_request": False,
    }
    target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return {"written": len(cleaned), "path": str(target)}
