#!/usr/bin/env python3
"""Create a deterministic candidate audit from the curated source catalog."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "improvement_sources.json"


def check_url(url: str) -> dict:
    request = Request(url, method="HEAD", headers={
        "User-Agent": "EnergyIntelligence-Knowledge-Auditor/1.0",
    })
    try:
        with urlopen(request, timeout=12) as response:
            return {
                "reachable": 200 <= response.status < 400,
                "http_status": response.status,
                "final_url": response.url,
            }
    except Exception as exc:  # network failures are audit evidence, not crashes
        return {
            "reachable": False,
            "error_type": type(exc).__name__,
        }


def build_report(online: bool = False) -> dict:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    candidates = []
    for source in catalog["sources"]:
        item = {
            **source,
            "state": "discovered",
            "production_eligible": False,
            "requires_human_review": True,
        }
        if online:
            item["network_check"] = check_url(source["url"])
        candidates.append(item)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "catalog_schema_version": catalog["schema_version"],
        "production_auto_promotion": False,
        "candidate_count": len(candidates),
        "candidates": candidates,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--online", action="store_true")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "knowledge-improvement-candidates.json",
    )
    args = parser.parse_args()
    args.output.write_text(
        json.dumps(build_report(online=args.online), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(args.output)
