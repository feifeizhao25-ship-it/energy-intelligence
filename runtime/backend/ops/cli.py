"""ops preflight / ops run daily / ops status"""
from __future__ import annotations

import json

from ops.geo import run_monitor
from ops.killswitch import is_killed
from ops.preflight import preflight
from ops.publish import publish_c
from ops.switches import SWITCHES


def status() -> dict:
    report = preflight()
    return {
        "killed": is_killed(),
        "switches": dict(SWITCHES),
        "modules": {name: item["enabled"] for name, item in report["modules"].items()},
        "tier_c": publish_c(),
        "geo": run_monitor(),
    }


def run_daily() -> dict:
    if is_killed():
        return {"ran": False, "reason": "kill switch"}
    return {"ran": True, "published": 0, "note": "switches default off; nothing was sent"}


def main(argv: list[str] | None = None) -> int:
    argv = list(argv or [])
    if not argv or argv[0] in {"-h", "--help"}:
        print("usage: python -m ops preflight|status | python -m ops run daily")
        return 0
    if argv[0] == "preflight":
        print(json.dumps(preflight(), ensure_ascii=False, indent=2))
        return 0
    if argv[0] == "status":
        print(json.dumps(status(), ensure_ascii=False, indent=2))
        return 0
    if argv[:2] == ["run", "daily"]:
        print(json.dumps(run_daily(), ensure_ascii=False, indent=2))
        return 0
    print("unknown command")
    return 2
