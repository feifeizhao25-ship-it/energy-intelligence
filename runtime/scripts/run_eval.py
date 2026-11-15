#!/usr/bin/env python3
"""make eval 的入口：实测门禁写入 latest.json，并在企业微信机器人未配置时只记录、不外发。"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(ROOT))

from app.services.eval_runner import write_latest  # noqa: E402


def main() -> int:
    raw = os.environ.get("NENGJIAN_EVAL_LATEST", "/var/lib/nengjian/eval/latest.json")
    path = Path(raw)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        path = Path("/tmp/nengjian-eval-latest.json")
    payload = write_latest(path)
    notice = f"新能源智库 eval passed={payload['passed']} metrics={payload['metrics']}"
    try:
        from ops.wecom import send_group_robot
        sent = send_group_robot(notice)
    except Exception as exc:
        sent = {"sent": False, "reason": exc.__class__.__name__}
    print(notice)
    print(f"wecom={sent} path={path}")
    return 0 if payload["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
