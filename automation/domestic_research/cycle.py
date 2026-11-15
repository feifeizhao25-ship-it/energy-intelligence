#!/usr/bin/env python3
"""Offline lookup of domestic research summaries.

Reads the local research index. Does not fetch the network, call a model,
or write into the user-facing knowledge base. Technical hits stay out of
the production RAG registry.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "runtime" / "backend" / "data" / "research" / "research_items.json"
ENERGY_MARKERS = ("光伏", "风电", "储能", "能源", "气象", "辐照", "pv", "solar", "wind", "energy", "pvlib", "pysam")
BLOCKED_LICENSE = ("agpl", "gpl-2", "gpl-3", "gpl-3.0", "cc-by-nc", "non-commercial", "非商用")


def _blob(item: dict) -> str:
    parts = [
        str(item.get("name") or ""),
        str(item.get("summary_zh") or ""),
        str(item.get("reason") or ""),
        " ".join(str(part) for part in item.get("modules") or []),
        str(item.get("license") or ""),
    ]
    return " ".join(parts)


def license_usable(item: dict) -> bool:
    text = " ".join(
        [
            str(item.get("license") or ""),
            " ".join(str(flag) for flag in item.get("license_flags") or []),
        ]
    ).lower()
    if not str(item.get("license") or "").strip():
        return False
    if any(token in text for token in BLOCKED_LICENSE):
        return False
    if "gpl" in text and "lgpl" not in text and "agpl" not in text:
        # plain "gpl" without a permissive exception
        if "mit" not in text and "apache" not in text and "bsd" not in text:
            return False
    return True


def energy_related(item: dict) -> bool:
    text = _blob(item).lower()
    return any(marker in text for marker in ENERGY_MARKERS)


def search(query: str, items: list[dict], limit: int = 8) -> list[dict]:
    needles = [part.lower() for part in (query or "").split() if part.strip()]
    if not needles:
        return []
    hits = []
    for item in items:
        if item.get("recommendation") == "不建议":
            continue
        if not energy_related(item):
            continue
        blob = _blob(item).lower()
        if not all(needle in blob for needle in needles):
            continue
        usable = license_usable(item)
        hits.append({
            "name": item.get("name"),
            "url": item.get("url"),
            "license": item.get("license") or "未标明",
            "usable": usable,
            "summary_zh": item.get("summary_zh") or "",
            "recommendation": item.get("recommendation"),
            "into_user_kb": False,
        })
        if len(hits) >= limit:
            break
    return hits


def load_items(path: Path = INDEX) -> list[dict]:
    if not path.is_file():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("items") if isinstance(payload, dict) else payload
    return [row for row in rows or [] if isinstance(row, dict)]


def run(product: str, query: str, index: Path = INDEX) -> dict:
    if product != "energy":
        return {
            "ok": False,
            "product": product,
            "error": "this cycle only serves product=energy and does not read other products",
            "wrote_knowledge_base": False,
            "auto_publish": False,
            "hits": [],
        }
    return {
        "ok": True,
        "product": "energy",
        "query": query,
        "index": str(index),
        "network": False,
        "wrote_knowledge_base": False,
        "auto_publish": False,
        "hits": search(query, load_items(index)),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Offline domestic research summary lookup")
    parser.add_argument("--product", required=True)
    parser.add_argument("--query", default="")
    parser.add_argument("--index", type=Path, default=INDEX)
    args = parser.parse_args(argv)
    report = run(args.product, args.query, args.index)
    json.dump(report, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0 if report.get("ok") else 2


if __name__ == "__main__":
    raise SystemExit(main())
