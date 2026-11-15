#!/usr/bin/env python3
"""Offline candidate list for the knowledge-improvement workflow.

Reads the local watchlist. Does not call a model or the network.
Candidates stay quarantined: nothing here is production-eligible.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WATCHLIST = ROOT / "data" / "improvement" / "watchlist.yaml"


def _repos(watch: dict) -> list[str]:
    github = watch.get("github") or {}
    names = []
    for key in ("repos_core", "repos_watch"):
        for name in github.get(key) or []:
            if name and name not in names:
                names.append(str(name))
    return names


def build_report(watch: dict | None = None) -> dict:
    if watch is None:
        try:
            import yaml
        except ImportError as exc:
            raise SystemExit("PyYAML is required to read the watchlist") from exc
        watch = yaml.safe_load(WATCHLIST.read_text(encoding="utf-8")) or {}
    candidates = []
    for name in _repos(watch):
        candidates.append({
            "id": name,
            "state": "discovered",
            "production_eligible": False,
            "requires_human_review": True,
            "auto_publish": False,
            "reviewer_signature": "",
            "url": f"https://github.com/{name}",
            "note": "离线清单条目。未核验许可变更，不入库。",
        })
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "runtime/backend/data/improvement/watchlist.yaml",
        "online": False,
        "production_auto_promotion": False,
        "candidate_count": len(candidates),
        "candidates": candidates,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--online", action="store_true", help="refused: this runtime entry does not call the network")
    parser.add_argument("--output", type=Path, default=ROOT / "knowledge-improvement-candidates.json")
    args = parser.parse_args(argv)
    if args.online:
        print("refusing --online: knowledge audit stays offline and does not call a model or the network", file=sys.stderr)
        return 2
    report = build_report()
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
