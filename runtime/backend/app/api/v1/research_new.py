"""国内文献语料检索。由 research.py 在境外源为空时调用，不再单独挂路由。"""

from __future__ import annotations

import json

from app.services.literature_batch_import import cache_path


def load_corpus(path=None) -> list[dict]:
    target = path or cache_path()
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    records = payload.get("records") if isinstance(payload, dict) else None
    return records if isinstance(records, list) else []


def search_domestic_corpus(query: str, path=None) -> list[dict]:
    needle = query.strip().lower()
    if len(needle) < 2:
        return []
    papers = []
    for row in load_corpus(path):
        title = str(row.get("title") or "")
        abstract = str(row.get("abstract") or "")
        if needle not in title.lower() and needle not in abstract.lower():
            continue
        year = row.get("year") if isinstance(row.get("year"), int) else 0
        papers.append({
            "id": row.get("external_id") or "",
            "title": title[:200],
            "authors": str(row.get("authors") or "")[:100],
            "year": year,
            "citations": 0,
            "abstract": abstract[:300],
            "doi": row.get("doi"),
            "url": row.get("url") or "",
            "journal": row.get("source") or "国内学术语料",
            "keywords": [needle],
            "licence": row.get("licence") or "",
        })
    return papers
